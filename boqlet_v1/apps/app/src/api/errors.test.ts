import { describe, expect, it } from "vitest";
import { ApiError, throwOnApiError } from "./errors";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("ApiError", () => {
  it("reads code, message and details from the error body", async () => {
    const error = await ApiError.fromResponse(
      json(409, { code: "revision_locked", message: "locked", details: { revisionId: "r1" } }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.code).toBe("revision_locked");
    expect(error.details).toEqual({ revisionId: "r1" });
  });

  it("falls back to http_<status> when the body is not JSON", async () => {
    const error = await ApiError.fromResponse(new Response("oops", { status: 502 }));
    expect(error.code).toBe("http_502");
  });

  it("is thrown by the middleware for 4xx and 5xx, not for 2xx", async () => {
    const onResponse = throwOnApiError.onResponse!;
    const ok = json(200, {});
    const params = { request: new Request("http://x"), options: {} as never, id: "1", schemaPath: "/x", params: {} };
    await expect(onResponse({ ...params, response: ok } as never)).resolves.toBe(ok);
    await expect(onResponse({ ...params, response: json(402, { code: "limit_reached", message: "" }) } as never)).rejects.toMatchObject({
      status: 402,
      code: "limit_reached",
    });
  });

  it("turns network failures into status 0", () => {
    const error = throwOnApiError.onError!({ error: new TypeError("fetch failed") } as never) as ApiError;
    expect(error.status).toBe(0);
    expect(error.code).toBe("network");
  });
});
