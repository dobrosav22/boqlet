import type { ApiError } from "./errors";

/**
 * What the app does with errors no screen handles itself (architecture.md, data layer rule 6):
 * 401 → sign in again; 402 → the limit dialog (F14); 409 → a toast and a refetch; anything else
 * on a mutation → a toast with the translated error. 404 on a query is thrown to the route's
 * error boundary, which shows the not-found page.
 *
 * The handlers are registered by the components that own them (the auth adapter, the limit
 * dialog, the toaster), so this module has no UI dependencies.
 */
export interface GlobalErrorHandlers {
  unauthorized(error: ApiError): void;
  limitReached(error: ApiError): void;
  conflict(error: ApiError): void;
  failed(error: ApiError): void;
}

const fallback: GlobalErrorHandlers = {
  unauthorized: () => {
    if (typeof window !== "undefined") {
      const returnTo = window.location.pathname + window.location.search;
      // Outside React (no router here); the auth adapter replaces this handler in FE-004.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
    }
  },
  limitReached: () => {},
  conflict: () => {},
  failed: () => {},
};

const handlers: GlobalErrorHandlers = { ...fallback };

export function registerGlobalErrorHandler<K extends keyof GlobalErrorHandlers>(kind: K, handler: GlobalErrorHandlers[K]) {
  handlers[kind] = handler;
  return () => {
    handlers[kind] = fallback[kind];
  };
}

export function globalErrorHandlers(): Readonly<GlobalErrorHandlers> {
  return handlers;
}
