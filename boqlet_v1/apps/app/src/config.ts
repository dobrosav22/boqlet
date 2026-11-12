/** The product's name: one value, never a literal spread through the code (design-guidelines.md "Brand"). */
export const APP_NAME = "boqlet";

/** Base URL of the API (`openapi.yaml` servers). In dev Next rewrites it to the mock (or Java). */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";
