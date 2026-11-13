import { MutationCache, QueryCache, QueryClient, type Query } from "@tanstack/react-query";
import { isApiError } from "./errors";
import { globalErrorHandlers } from "./global-errors";

/** Errors a screen shows itself (inline, with retry) versus the ones handled once, globally. */
export function isHandledGlobally(error: unknown): boolean {
  return isApiError(error) && (error.status === 401 || error.status === 402 || error.status === 409);
}

export function makeQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError(error, query: Query<unknown, unknown, unknown>) {
        if (!isApiError(error)) return;
        const h = globalErrorHandlers();
        if (error.status === 401) h.unauthorized(error);
        else if (error.status === 402) h.limitReached(error);
        else if (error.status === 409) {
          h.conflict(error);
          void client.invalidateQueries({ queryKey: query.queryKey });
        }
      },
    }),
    mutationCache: new MutationCache({
      onError(error, _variables, _context, mutation) {
        if (!isApiError(error)) return;
        const h = globalErrorHandlers();
        if (error.status === 401) h.unauthorized(error);
        else if (error.status === 402) h.limitReached(error);
        else if (error.status === 409) {
          // A mutation that explains its own conflicts inline (meta.ownConflicts) gets no toast.
          if (!mutation.meta?.ownConflicts) h.conflict(error);
          void client.invalidateQueries();
        } else if (!mutation.options.onError) h.failed(error);
      },
    }),
    defaultOptions: {
      queries: {
        // Mutable lists: 30 s plus SSE invalidation; immutable data sets staleTime: Infinity per query.
        staleTime: 30_000,
        retry: (count, error) => !(isApiError(error) && error.status >= 400 && error.status < 500) && count < 2,
        // 404 goes to the route's error boundary (the not-found page); other errors stay inline.
        throwOnError: (error) => isApiError(error) && error.status === 404,
      },
    },
  });
  return client;
}
