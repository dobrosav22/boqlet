/**
 * `/api/v1/*`: every request is matched against `openapi.yaml`, authenticated, and validated
 * (path and query parameters, JSON body with unknown fields rejected) before its handler runs.
 * Outside production, JSON responses are validated too: a response that doesn't match the
 * contract becomes a 500 with the validation errors, so drift shows up at once (mock-api.md).
 */
import type { Context } from "hono";
import { userFromAuthorization } from "./auth.js";
import { HttpError, unauthenticated } from "./http.js";
import { describeErrors, escapePointer, type Operation, type Spec } from "@ifc-boq/api/spec";
import type { UserRec } from "./store.js";

type Json = Record<string, unknown>;

export interface Ctx {
  c: Context;
  op: Operation;
  /** null only on public operations (`security: []`). */
  user: UserRec | null;
  params: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
}
export type Handler = (ctx: Ctx) => Response | Promise<Response>;
export type Handlers = Partial<Record<string, Handler>>;

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
export const noContent = () => new Response(null, { status: 204 });

const validateResponses = () => process.env.MOCK_VALIDATE_RESPONSES !== "0" && process.env.NODE_ENV !== "production";

/** Follows `$ref`s inside the bundled document; returns the object and its JSON pointer. */
function deref(doc: Json, value: Json, pointer: string): { value: Json; pointer: string } {
  let v = value;
  let p = pointer;
  for (let i = 0; i < 10 && typeof v?.$ref === "string" && (v.$ref as string).startsWith("#/"); i++) {
    p = v.$ref as string;
    v = (p.slice(2).split("/") as string[]).reduce<unknown>(
      (acc, key) => (acc as Json)?.[key.replace(/~1/g, "/").replace(/~0/g, "~")],
      doc,
    ) as Json;
  }
  return { value: v, pointer: p };
}

function coerce(value: string | string[] | undefined, schema: Json | undefined): unknown {
  if (value === undefined) return undefined;
  const type = schema?.type;
  if (type === "array") {
    const items = Array.isArray(value) ? value : value.split(",");
    return items.map((v) => coerce(v, schema?.items as Json | undefined));
  }
  const one = Array.isArray(value) ? value[value.length - 1]! : value;
  if (type === "integer" || type === "number") return one.trim() !== "" && !Number.isNaN(Number(one)) ? Number(one) : one;
  if (type === "boolean") return one === "true" ? true : one === "false" ? false : one;
  return one;
}

export function apiRouter(spec: Spec, handlers: Handlers) {
  return async (c: Context): Promise<Response> => {
    try {
      const url = new URL(c.req.url);
      const subPath = url.pathname.replace(/^\/api\/v1/, "") || "/";
      const found = spec.match(c.req.method, subPath);
      if (!found) throw new HttpError(404, "not_found", `No such endpoint: ${c.req.method} ${subPath}`);
      if ("allowed" in found) {
        return json({ code: "method_not_allowed", message: `Use ${found.allowed.join(", ")}` }, 405, { Allow: found.allowed.join(", ") });
      }
      const { op, params } = found;

      const user = userFromAuthorization(c.req.header("Authorization"));
      if (op.secured && !user) throw unauthenticated();

      // Parameters
      const query: Record<string, unknown> = {};
      const paramErrors: unknown[] = [];
      ((op.raw.parameters as Json[]) ?? []).forEach((rawParam, i) => {
        const { value: p, pointer } = deref(spec.doc, rawParam, op.parameterPointers[i]!);
        const where = p.in as string;
        if (where !== "path" && where !== "query") return;
        const name = p.name as string;
        const schema = p.schema as Json | undefined;
        const raw = where === "path" ? params[name] : schema?.type === "array" ? c.req.queries(name) : c.req.query(name);
        const value = coerce(raw, schema);
        if (value === undefined) {
          if (p.required || where === "path") paramErrors.push({ name, message: "is required" });
          return;
        }
        if (schema) {
          const validate = spec.validator(`${pointer}/schema`);
          if (!validate(value)) paramErrors.push({ name, errors: describeErrors(validate.errors) });
        }
        if (where === "query") query[name] = value;
      });
      if (paramErrors.length) throw new HttpError(400, "invalid_param", "Invalid parameters.", { params: paramErrors });

      // Body
      let body: unknown = undefined;
      if (op.raw.requestBody) {
        const { value: rb, pointer: rbPointer } = deref(spec.doc, op.raw.requestBody as Json, `${op.pointer}/requestBody`);
        const content = (rb.content ?? {}) as Record<string, Json>;
        const type = (c.req.header("Content-Type") ?? "").split(";")[0]!.trim();
        if (content["application/json"] && (type === "application/json" || type === "")) {
          const text = await c.req.text();
          if (!text) {
            if (rb.required) throw new HttpError(400, "invalid_body", "A JSON body is required.");
          } else {
            try {
              body = JSON.parse(text);
            } catch {
              throw new HttpError(400, "invalid_body", "The body is not valid JSON.");
            }
            const validate = spec.validator(`${rbPointer}/content/application~1json/schema`, { strictBody: true });
            if (!validate(body)) {
              const unknown = validate.errors?.find((e) => e.keyword === "unevaluatedProperties");
              if (unknown) {
                const field = (unknown.params as { unevaluatedProperty?: string }).unevaluatedProperty;
                throw new HttpError(400, "unknown_field", `Unknown field: ${field}`, { field });
              }
              throw new HttpError(400, "invalid_body", "The body does not match the contract.", { errors: describeErrors(validate.errors) });
            }
          }
        } else if (content["multipart/form-data"] && type === "multipart/form-data") {
          body = await c.req.formData();
        } else if (rb.required) {
          throw new HttpError(415, "unsupported_media_type", `Send one of: ${Object.keys(content).join(", ")}`);
        }
      }

      const handler = handlers[op.operationId];
      if (!handler) {
        return json({ code: "not_implemented", message: `The mock does not implement ${op.operationId} yet.` }, 501);
      }
      const response = await handler({ c, op, user, params, query, body });
      return validateResponses() ? await checkResponse(spec, op, response) : response;
    } catch (e) {
      if (e instanceof HttpError) return json(e.body(), e.status);
      console.error(e);
      return json({ code: "internal", message: (e as Error).message ?? "internal error" }, 500);
    }
  };
}

async function checkResponse(spec: Spec, op: Operation, response: Response): Promise<Response> {
  if (!(response.headers.get("Content-Type") ?? "").startsWith("application/json")) return response;
  const responses = (op.raw.responses ?? {}) as Record<string, Json>;
  const status = String(response.status);
  const key = responses[status] ? status : responses[`${status[0]}XX`] ? `${status[0]}XX` : responses.default ? "default" : null;
  if (!key) {
    if (response.status >= 400) return response; // shared errors are documented once (conventions.md)
    return json({ code: "internal", message: `The mock answered ${status}, which ${op.operationId} does not declare.` }, 500);
  }
  const { value: res, pointer } = deref(spec.doc, responses[key]!, `${op.pointer}/responses/${escapePointer(key)}`);
  if (!(res.content as Json | undefined)?.["application/json"]) return response;
  const body = await response.clone().json();
  const validate = spec.validator(`${pointer}/content/application~1json/schema`);
  if (validate(body)) return response;
  return json(
    { code: "internal", message: `Mock response for ${op.operationId} does not match openapi.yaml`, details: { errors: describeErrors(validate.errors) } },
    500,
  );
}
