"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeReturnTo, type AuthAdapter, type Session } from "../AuthAdapter";
import { readMockSession, subscribeMockSession, writeMockSession } from "./mock-session";

/** A seeded user as the mock's `GET /_dev/users` lists them. */
interface DevUser {
  id: string;
  name: string;
  email: string;
  token: string;
  platformRole: string | null;
  memberships: { orgSlug?: string; role: string }[];
}

const DEV_USERS_URL = "/_dev/users";

function go(path: string) {
  window.location.assign(path);
}

function signInUrl(opts?: { returnTo?: string; email?: string; reason?: string }) {
  const q = new URLSearchParams();
  if (opts?.reason) q.set("reason", opts.reason);
  if (opts?.returnTo) q.set("returnTo", opts.returnTo);
  if (opts?.email) q.set("email", opts.email);
  const s = q.toString();
  return `/sign-in${s ? `?${s}` : ""}`;
}

/**
 * Mock auth (phase 1): a sign-in page that lists the mock's seeded users; the token is
 * `mock:<userId>`. Replaced by the real provider's adapter after BE-000 (FE-043).
 */
export const mockAuthAdapter: AuthAdapter = {
  id: "mock",
  useSession(): Session {
    const session = useSyncExternalStore(subscribeMockSession, readMockSession, () => undefined);
    if (session === undefined) return { status: "loading" };
    return session ? { status: "authenticated", name: session.name, email: session.email } : { status: "anonymous" };
  },
  async getAccessToken() {
    return readMockSession()?.token ?? null;
  },
  async signIn(opts) {
    go(signInUrl(opts));
  },
  async signUp(opts) {
    // One page for both: the mock's sign-in page has the sign-up form below the seeded users.
    go(signInUrl(opts));
  },
  async signOut(opts) {
    writeMockSession(null);
    go(signInUrl({ returnTo: opts?.returnTo, reason: opts?.reason }));
  },
  appSession() {
    const s = readMockSession();
    if (!s) return null;
    if (s.sessionless) return "exempt";
    return s.sessionId ? { id: s.sessionId } : null;
  },
  bindAppSession(sessionId) {
    const s = readMockSession();
    if (!s) return;
    // The session's id travels with the token, like a `sid` claim bound at session creation (security.md).
    writeMockSession({ ...s, sessionId, token: `mock:${s.userId}:${sessionId}` });
  },
  SignInPage: MockSignInPage,
};

function MockSignInPage() {
  const t = useTranslations("auth");
  const roles = useTranslations("common.roles");
  const router = useRouter();
  const search = useSearchParams();
  const returnTo = safeReturnTo(search.get("returnTo"));
  const [users, setUsers] = useState<DevUser[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(search.get("email") ?? "");
  const [signUpFailed, setSignUpFailed] = useState(false);

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setSignUpFailed(false);
    const res = await fetch(DEV_USERS_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email }) });
    if (!res.ok) return setSignUpFailed(true);
    pick((await res.json()) as DevUser);
  }

  useEffect(() => {
    let alive = true;
    fetch(DEV_USERS_URL)
      .then((r) => (r.ok ? (r.json() as Promise<DevUser[]>) : Promise.reject(new Error(String(r.status)))))
      .then((list) => alive && setUsers(list))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  function pick(user: DevUser) {
    writeMockSession({ token: user.token, userId: user.id, name: user.name, email: user.email });
    router.replace(returnTo);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-8 py-16">
      <Wordmark className="text-display-sm" />
      <div className="flex flex-col gap-1">
        <h1 className="text-title">{t("signIn.title")}</h1>
        <p className="prose-text text-muted-foreground">{t("mock.intro")}</p>
      </div>
      {failed && (
        <p role="alert" className="text-error">
          {t("mock.unreachable")}
        </p>
      )}
      {!users && !failed && <p className="text-muted-foreground">{t("mock.loading")}</p>}
      {users && (
        <ul className="flex flex-col divide-y divide-border border-y border-border" data-testid="mock-users">
          {users.map((user) => (
            <li key={user.id} className="flex items-center gap-4 py-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{user.name}</span>
                <span className="label-caps truncate text-muted-foreground">
                  {user.platformRole
                    ? t("mock.platformAdmin")
                    : user.memberships.map((m) => t("mock.membership", { org: m.orgSlug ?? "", role: roles.has(m.role) ? roles(m.role) : m.role })).join(" · ") ||
                      t("mock.noOrg")}
                </span>
              </div>
              <Button variant="outline" onClick={() => pick(user)} data-testid={`sign-in-as-${user.email}`}>
                {t("mock.signInAs")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {/* Shown once the page is interactive (the users list has loaded), so a submit never runs before hydration. */}
      {(users || failed) && (
      <form onSubmit={signUp} className="flex flex-col gap-3 border-t border-border pt-6" data-testid="mock-sign-up">
        <h2 className="label-caps text-muted-foreground">{t("mock.signUpTitle")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Input aria-label={t("mock.name")} placeholder={t("mock.name")} value={name} onChange={(e) => setName(e.target.value)} required data-testid="sign-up-name" />
          <Input aria-label={t("mock.email")} placeholder={t("mock.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="sign-up-email" />
        </div>
        {signUpFailed && (
          <p role="alert" className="text-error">
            {t("mock.signUpFailed")}
          </p>
        )}
        <div>
          <Button type="submit" data-testid="sign-up-submit">
            {t("mock.signUp")}
          </Button>
        </div>
      </form>
      )}
    </main>
  );
}
