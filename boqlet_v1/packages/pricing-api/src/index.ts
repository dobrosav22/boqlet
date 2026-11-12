/**
 * The pricing module's API client (`openapi-pricing.yaml`, P36). Only the pricing module
 * (`packages/pricing-ui`, the mock's pricing plugin, the module's suites) imports this package;
 * core code never does.
 */
import createClient, { type Client, type ClientOptions, type Middleware } from "openapi-fetch";
import type { components, operations, paths } from "./schema";

export type { components, operations, paths };
export type PricingSchemas = components["schemas"];
export type PricingApiClient = Client<paths>;

export interface PricingApiClientOptions extends Omit<ClientOptions, "baseUrl"> {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null> | string | null;
  middleware?: Middleware[];
}

export function createPricingApiClient({ baseUrl, getAccessToken, middleware = [], ...rest }: PricingApiClientOptions): PricingApiClient {
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
