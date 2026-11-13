import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { ApiError } from "@/api/errors";
import { authAdapter } from "./index";

export type AppSession = Schemas["Session"];

/** "Chrome on Windows": the browser and system from the user agent, for the takeover question (F01 §10). */
export function deviceLabel(ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent): string {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const system = /Windows/.test(ua) ? "Windows" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /Linux/.test(ua) ? "Linux" : "";
  return system ? `${browser} on ${system}` : browser;
}

export type OpenResult = { kind: "open"; session: AppSession } | { kind: "conflict"; active: AppSession };

/**
 * Opens the app's session after sign-in (`POST /sessions`, BR-54) and binds the sign-in to it.
 * Another active session of the account comes back as a conflict, unless `takeover`.
 */
export async function openAppSession(takeover = false): Promise<OpenResult> {
  try {
    const { data } = await api.POST("/sessions", { body: { deviceLabel: deviceLabel(), takeover } });
    authAdapter.bindAppSession(data!.id);
    return { kind: "open", session: data! };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409 && e.code === "session_active") {
      const active = (e.body as { activeSession?: AppSession } | undefined)?.activeSession;
      if (active) return { kind: "conflict", active };
    }
    throw e;
  }
}

/** Ends the app's session (sign-out), then signs out at the provider. */
export async function signOutOfApp(opts?: { returnTo?: string }) {
  if (typeof authAdapter.appSession() === "object" && authAdapter.appSession() !== null) {
    await api.DELETE("/sessions/current").catch(() => {});
  }
  await authAdapter.signOut(opts);
}
