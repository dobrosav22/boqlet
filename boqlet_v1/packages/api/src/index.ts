/**
 * The core API client (`openapi.yaml`), generated types plus a small factory over openapi-fetch.
 *
 * Every consumer (the Next app, the contract and scenario suites) builds its client here, so the
 * base URL is the only thing that changes between the mock and the Java backend (P11).
 */
import createClient, { type Client, type ClientOptions, type Middleware } from "openapi-fetch";
import type { components, operations, paths } from "./schema";

export type { components, operations, paths };
export type Schemas = components["schemas"];
export type ApiClient = Client<paths>;

/** The error body every non-2xx response carries (conventions.md "Errors"). */
export type ApiErrorBody = Schemas["Error"];

export interface ApiClientOptions extends Omit<ClientOptions, "baseUrl"> {
  /** For example `/api/v1` in the browser, `http://localhost:4010/api/v1` in tests. */
  baseUrl: string;
  /** Bearer token for each request, or null when the auth provider uses cookies. */
  getAccessToken?: () => Promise<string | null> | string | null;
  /** Extra middleware (logging, error mapping); run after the auth header is set. */
  middleware?: Middleware[];
}

export function createApiClient({ baseUrl, getAccessToken, middleware = [], ...rest }: ApiClientOptions): ApiClient {
  const client = createClient<paths>({ baseUrl, ...rest });
  if (getAccessToken) {
    client.use({
      async onRequest({ request }) {
        const token = await getAccessToken();
        if (token && !request.headers.has("Authorization")) request.headers.set("Authorization", `Bearer ${token}`);
        return request;
      },
    });
  }
  for (const m of middleware) client.use(m);
  return client;
}
