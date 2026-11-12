/** Errors as the contract defines them (conventions.md "Errors"): `{code, message, details}`. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
  body() {
    return { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) };
  }
}

export const unauthenticated = () => new HttpError(401, "unauthenticated", "Sign in first.");
export const forbidden = (required?: string) =>
  new HttpError(403, "forbidden", "Your role does not allow this.", required ? { required } : undefined);
export const notFound = (what = "resource") => new HttpError(404, "not_found", `The ${what} does not exist or is not visible to you.`);
export const conflict = (code: string, message: string, details?: Record<string, unknown>) => new HttpError(409, code, message, details);
export const limitReached = (limit: string, current: number, max: number) =>
  new HttpError(402, "limit_reached", `The plan allows ${max} (${limit}).`, { limit, current, max });
