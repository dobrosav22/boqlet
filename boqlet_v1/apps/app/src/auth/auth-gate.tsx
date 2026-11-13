"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { authAdapter, useSession } from "@/auth";
import { openAppSession } from "./app-session";
import { isLeaving } from "./leaving";

/**
 * The signed-in part of the app: anonymous visitors go to sign-in and come back afterwards. A
 * signed-in person gets the app's session first (F01 §10, BR-54): opened here after sign-in, or,
 * when the account is open on another device, the takeover question at `/session-conflict`.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const t = useTranslations("auth.session");
  const message = useErrorMessage();
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const returnTo = pathname + (search ? `?${search}` : "");
  const [failed, setFailed] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (status === "anonymous" && !isLeaving()) router.replace(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  }, [status, returnTo, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (authAdapter.appSession() !== null) return;
    let alive = true;
    openAppSession()
      .then((r) => {
        if (!alive) return;
        // Binding the session updates the adapter's store, which re-renders this gate.
        if (r.kind === "conflict") router.replace(`/session-conflict?returnTo=${encodeURIComponent(returnTo)}`);
      })
      .catch((e) => alive && setFailed(e));
    return () => {
      alive = false;
    };
    // The session is opened once per sign-in, not on every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, attempt]);

  // Read on every render: the adapter's store re-renders the gate when the session is bound.
  const bound = status === "authenticated" && authAdapter.appSession() !== null;
  useEffect(() => {
    if (bound) document.documentElement.dataset.session = "active";
  }, [bound]);

  if (failed)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
        <p role="alert" className="text-error">
          {message(failed)}
        </p>
        <Button variant="outline" onClick={() => {
            setFailed(null);
            setAttempt((n) => n + 1);
          }}>
          {t("retry")}
        </Button>
      </div>
    );
  if (status !== "authenticated" || !bound) return <div className="min-h-dvh" aria-busy="true" />;
  return children;
}
