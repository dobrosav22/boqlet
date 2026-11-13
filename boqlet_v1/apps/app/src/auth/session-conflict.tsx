"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { safeReturnTo } from "@/auth/AuthAdapter";
import { Wordmark } from "@/components/shell/wordmark";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { useRelativeTime } from "@/i18n/use-relative-time";
import { authAdapter, useSession } from "./index";
import { openAppSession, type AppSession } from "./app-session";

/**
 * S31 (F01 §10): "You're signed in on Chrome on Windows (Belgrade), last active 3 minutes ago.
 * Continue here and sign out there?" Continue takes the session over (the other device is signed
 * out); Cancel signs out here and leaves the other device as it is.
 */
export function SessionConflict() {
  const t = useTranslations("auth.session");
  const message = useErrorMessage();
  const relative = useRelativeTime();
  const router = useRouter();
  const returnTo = safeReturnTo(useSearchParams().get("returnTo"));
  const { status } = useSession();
  const [active, setActive] = useState<AppSession | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "anonymous") router.replace(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
    if (status !== "authenticated") return;
    if (authAdapter.appSession() !== null) {
      router.replace(returnTo);
      return;
    }
    let alive = true;
    // Asked again here: the other session may have ended meanwhile.
    openAppSession()
      .then((r) => {
        if (!alive) return;
        if (r.kind === "open") router.replace(returnTo);
        else setActive(r.active);
      })
      .catch((e) => alive && setError(e));
    return () => {
      alive = false;
    };
  }, [status, returnTo, router]);

  async function takeOver() {
    setBusy(true);
    try {
      await openAppSession(true);
      router.replace(returnTo);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-8 py-16" data-testid="session-conflict-page">
      <Wordmark className="text-display-sm" />
      {active && (
        <div className="flex flex-col gap-4" data-testid="session-conflict">
          <h1 className="text-title">{t("title")}</h1>
          <p className="prose-text" data-testid="session-conflict-text">
            {active.place
              ? t("openElsewherePlace", { device: active.deviceLabel, place: active.place, when: relative(active.lastSeenAt) })
              : t("openElsewhere", { device: active.deviceLabel, when: relative(active.lastSeenAt) })}
          </p>
          <p className="text-muted-foreground">{t("explain")}</p>
          <div className="flex gap-3">
            <Button onClick={takeOver} disabled={busy} data-testid="session-continue">
              {t("continue")}
            </Button>
            <Button variant="outline" onClick={() => void authAdapter.signOut({ returnTo })} disabled={busy} data-testid="session-cancel">
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
      {!active && !error && <div className="h-24" aria-busy="true" />}
      {error ? (
        <p role="alert" className="text-error">
          {message(error)}
        </p>
      ) : null}
    </main>
  );
}
