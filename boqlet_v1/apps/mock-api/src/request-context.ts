/**
 * What the request being handled is (its operation and user), for code deep inside a handler that
 * records it, such as the limit events (F19). Set by the router around every handler.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestInfo {
  operationId: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestInfo>();

export const runInRequest = <T>(info: RequestInfo, fn: () => T): T => storage.run(info, fn);

export const currentRequest = (): RequestInfo | undefined => storage.getStore();
