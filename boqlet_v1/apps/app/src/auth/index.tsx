"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { setAccessTokenSource } from "@/api/client";
import { registerGlobalErrorHandler } from "@/api/global-errors";
import type { AuthAdapter } from "./AuthAdapter";
import { mockAuthAdapter } from "./adapters/mock";
import { isLeaving, startLeaving } from "./leaving";

/** The adapter in use: `NEXT_PUBLIC_AUTH_ADAPTER` (only `mock` until BE-000 decides the provider). */
const ADAPTERS: Record<string, AuthAdapter> = { mock: mockAuthAdapter };
export const authAdapter: AuthAdapter = ADAPTERS[process.env.NEXT_PUBLIC_AUTH_ADAPTER ?? "mock"] ?? mockAuthAdapter;

// The API client asks the adapter for the token on every request.
setAccessTokenSource(() => authAdapter.getAccessToken());

const AuthContext = createContext<AuthAdapter>(authAdapter);

/** 401 codes that mean "signed out on purpose", with a message on the sign-in page (F01 §10). */
export const SIGNED_OUT_REASONS = new Set(["session_replaced", "session_expired"]);

/**
 * Signs out because the app's session ended elsewhere (taken over, or idle): the sign-in page
 * says why. Used by the 401 handler and by the `session.revoked` event.
 */
export function signedOut(reason: string) {
  if (isLeaving()) return;
  startLeaving();
  void authAdapter.signOut({ returnTo: window.location.pathname + window.location.search, reason });
}

/**
 * Provides the adapter and sends every 401 to its sign-in, back to where the user was; a replaced or
 * expired session signs out with the reason (F01 §10).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(
    () =>
      registerGlobalErrorHandler("unauthorized", (error) => {
        if (isLeaving()) return;
        if (SIGNED_OUT_REASONS.has(error.code)) signedOut(error.code);
        else {
          startLeaving();
          void authAdapter.signIn({ returnTo: window.location.pathname + window.location.search });
        }
      }),
    [],
  );
  return <AuthContext.Provider value={authAdapter}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export const useSession = () => authAdapter.useSession();
