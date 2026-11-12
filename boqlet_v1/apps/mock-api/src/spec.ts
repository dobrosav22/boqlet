/**
 * The contract, loaded once: `packages/api/openapi.yaml` bundled (external engine schemas pulled
 * in), a route table, and Ajv validators for parameters, request bodies and responses.
 * The mock answers only what this file declares; everything else is 404.
 */
import { bundle, createConfig } from "@redocly/openapi-core";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ErrorObject, ValidateFunction } from "ajv";
import { CONTRACT_PATH } from "./paths.js";

type Json = Record<string, unknown>;

export interface Operation {
  method: string;
  path: string;
  operationId: string;
  regex: RegExp;
  paramNames: string[];
  /** false for `security: []` (public endpoints) */
  secured: boolean;
  raw: Json;
  pointer: string;
}

export interface Spec {
  doc: Json;
  operations: Operation[];
  match(method: string, path: string): { op: Operation; params: Record<string, string> } | { allowed: string[] } | null;
  validator(pointer: string, opts?: { strictBody?: boolean }): ValidateFunction;
}

const escapePointer = (s: string) => s.replace(/~/g, "~0").replace(/\//g, "~1");

export async function loadSpec(file = CONTRACT_PATH): Promise<Spec> {
  const config = await createConfig({});
  const { bundle: result } = await bundle({ ref: file, config, dereference: false });
  const doc = result.parsed as Json;

  const ajv = new Ajv2020({ strict: false, allErrors: true, coerceTypes: false, discriminator: false });
  addFormats(ajv);
  ajv.addFormat("binary", true);
  ajv.addSchema(stripSchemaDialects(doc), "openapi.json");

  const operations: Operation[] = [];
  const globalSecured = Array.isArray(doc.security) && (doc.security as unknown[]).length > 0;
  for (const [path, item] of Object.entries((doc.paths ?? {}) as Record<string, Json>)) {
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      const raw = item[method] as Json | undefined;
      if (!raw) continue;
      const paramNames: string[] = [];
      const pattern = path.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{(\w+)\\?\}/g, (_m, name: string) => {
        paramNames.push(name);
        return "([^/]+)";
      });
      const security = raw.security as unknown[] | undefined;
      operations.push({
        method: method.toUpperCase(),
        path,
        operationId: String(raw.operationId),
        regex: new RegExp(`^${pattern}$`),
        paramNames,
        secured: security ? security.length > 0 : globalSecured,
        raw: { ...raw, parameters: [...((item.parameters as unknown[]) ?? []), ...((raw.parameters as unknown[]) ?? [])] },
        pointer: `#/paths/${escapePointer(path)}/${method}`,
      });
    }
  }
  // Literal segments win over parameters (`/orgs/current` before `/orgs/{orgId}`).
  operations.sort((a, b) => a.paramNames.length - b.paramNames.length);

  const cache = new Map<string, ValidateFunction>();
  return {
    doc,
    operations,
    match(method, path) {
      const allowed: string[] = [];
      for (const op of operations) {
        const m = op.regex.exec(path);
        if (!m) continue;
        if (op.method !== method) {
          allowed.push(op.method);
          continue;
        }
        const params: Record<string, string> = {};
        op.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(m[i + 1]!)));
        return { op, params };
      }
      return allowed.length ? { allowed } : null;
    },
    validator(pointer, opts = {}) {
      const key = `${pointer}|${opts.strictBody ? 1 : 0}`;
      let fn = cache.get(key);
      if (!fn) {
        const ref = { $ref: `openapi.json${pointer}` };
        // Unknown fields in a request body are rejected (conventions.md): checked at the top level.
        fn = ajv.compile(opts.strictBody ? { allOf: [ref], unevaluatedProperties: false } : ref);
        cache.set(key, fn);
      }
      return fn;
    },
  };
}

/** Engine schemas come from draft-07 files; one 2020-12 validator reads them all. */
function stripSchemaDialects<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripSchemaDialects) as T;
  if (value && typeof value === "object") {
    const out: Json = {};
    for (const [k, v] of Object.entries(value as Json)) if (k !== "$schema" && k !== "$id") out[k] = stripSchemaDialects(v);
    return out as T;
  }
  return value;
}

export function describeErrors(errors: ErrorObject[] | null | undefined) {
  return (errors ?? []).slice(0, 20).map((e) => ({ path: e.instancePath || "/", message: e.message ?? e.keyword, keyword: e.keyword, params: e.params }));
}

export { escapePointer };
