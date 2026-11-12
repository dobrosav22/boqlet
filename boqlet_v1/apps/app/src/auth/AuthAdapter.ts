import type { ComponentType } from "react";

/**
 * How the app signs people in, independent of the provider (P10, 06-frontend/architecture.md
 * "Auth adapter"). The mock adapter is used until BE-000 picks the real provider; no component
 * imports a provider SDK directly.
 */
export interface Session {
  /** "loading" until the provider has restored a session. */
  status: "loading" | "authenticated" | "anonymous";
  email?: string;
  name?: string;
}

export interface AuthAdapter {
  readonly id: string;
  useSession(): Session;
  /** Bearer token for API calls, or null when the provider uses cookies. */
  getAccessToken(): Promise<string | null>;
  signIn(opts?: { returnTo?: string; email?: string }): Promise<void>;
  signUp(opts?: { returnTo?: string; email?: string }): Promise<void>;
  signOut(): Promise<void>;
  /** Optional embedded UI for providers that render forms in-app. */
  SignInPage?: ComponentType;
  SignUpPage?: ComponentType;
}

/** Only same-site paths are accepted as `returnTo` (no open redirects). */
export function safeReturnTo(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
