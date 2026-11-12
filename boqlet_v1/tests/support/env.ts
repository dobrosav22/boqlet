import { createApiClient, type ApiClient } from "@ifc-boq/api";

/**
 * Where the suites run. `API_URL` is the API base (`http://localhost:4010/api/v1` for the mock,
 * the Java service in phase 2); the backend's root (for `/_test/*`) is derived from it.
 */
export const API_URL = (process.env.API_URL ?? "http://localhost:4010/api/v1").replace(/\/$/, "");
export const ROOT_URL = API_URL.replace(/\/api\/v1$/, "");
export const TARGET = process.env.SUITE_TARGET ?? "mock";

/** A client as one user (or anonymous). The suites use only the generated client and HTTP. */
export function client(token?: string | null): ApiClient {
  return createApiClient({ baseUrl: API_URL, getAccessToken: () => token ?? null });
}
