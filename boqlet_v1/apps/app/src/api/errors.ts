import type { Middleware } from "openapi-fetch";
import type { ApiErrorBody } from "@ifc-boq/api";

/**
 * Every failed API call becomes one `ApiError` (06-frontend/architecture.md, data layer rule 6).
 * `status` 0 means the request never got an answer (network down, server not running).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;
  /** The whole error body, for errors that carry more than `details` (e.g. `SessionConflict`). */
  readonly body: unknown;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.body = body;
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    let body: Partial<ApiErrorBody> | undefined;
    try {
      body = (await response.clone().json()) as Partial<ApiErrorBody>;
    } catch {
      body = undefined;
    }
    return new ApiError(
      response.status,
      body?.code ?? `http_${response.status}`,
      body?.message ?? response.statusText ?? "",
      body?.details as Record<string, unknown> | undefined,
      body,
    );
  }

  static network(cause: unknown): ApiError {
    const error = new ApiError(0, "network", cause instanceof Error ? cause.message : String(cause));
    return error;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** openapi-fetch middleware: throw an `ApiError` for every non-2xx answer (redirects pass). */
export const throwOnApiError: Middleware = {
  async onResponse({ response }) {
    if (response.status >= 400) throw await ApiError.fromResponse(response);
    return response;
  },
  onError({ error }) {
    if (error instanceof ApiError) return error;
    return ApiError.network(error);
  },
};
