"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { setAccessTokenSource } from "@/api/client";
import { registerGlobalErrorHandler } from "@/api/global-errors";
import type { AuthAdapter } from "./AuthAdapter";
import { mockAuthAdapter } from "./adapters/mock";

/** The adapter in use: `NEXT_PUBLIC_AUTH_ADAPTER` (only `mock` until BE-000 decides the provider). */
const ADAPTERS: Record<string, AuthAdapter> = { mock: mockAuthAdapter };
export const authAdapter: AuthAdapter = ADAPTERS[process.env.NEXT_PUBLIC_AUTH_ADAPTER ?? "mock"] ?? mockAuthAdapter;

// The API client asks the adapter for the token on every request.
setAccessTokenSource(() => authAdapter.getAccessToken());

const AuthContext = createContext<AuthAdapter>(authAdapter);

/** Provides the adapter and sends every 401 to its sign-in, back to where the user was. */
export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(
    () =>
      registerGlobalErrorHandler("unauthorized", () => {
        void authAdapter.signIn({ returnTo: window.location.pathname + window.location.search });
      }),
    [],
  );
  return <AuthContext.Provider value={authAdapter}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export const useSession = () => authAdapter.useSession();
