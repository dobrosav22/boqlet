"use client";

import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { keys } from "@/api/keys";
import { authAdapter, SIGNED_OUT_REASONS, signedOut, useSession } from "@/auth";
import { invalidationsFor } from "./invalidation";
import { connectRealtime } from "./sse";

/** Opens the tab's SSE connection while signed in and turns events into query refetches. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const { status } = useSession();
  const t = useTranslations("notifications");

  useEffect(() => {
    if (status !== "authenticated") return;
    return connectRealtime({
      getToken: () => authAdapter.getAccessToken(),
      onEvent(e) {
        // F01 §10: the account was opened on another device and this session was taken over.
        if (e.event === "session.revoked") {
          const mine = authAdapter.appSession();
          if (typeof mine === "object" && mine !== null && e.data.sessionId === mine.id) signedOut("session_replaced");
          return;
        }
        if (e.event === "job.progress" && typeof e.data.jobId === "string") {
          client.setQueryData(keys.jobProgress(e.data.jobId), e.data);
          return;
        }
        for (const queryKey of invalidationsFor(e)) void client.invalidateQueries({ queryKey });
        // A toast for each notification (the bell and the list come with FE-018).
        if (e.event === "notification.created" && typeof e.data.kind === "string") {
          const key = `kinds.${e.data.kind.replaceAll(".", "_")}`;
          const params = (e.data.params ?? {}) as Record<string, string | number>;
          const url = typeof e.data.url === "string" ? e.data.url : null;
          // Keyed by the notification id: the same notification never shows twice (e.g. replayed after a reconnect).
          const id = typeof e.data.id === "string" ? e.data.id : undefined;
          toast(t.has(key) ? t(key, params) : e.data.kind, { id, ...(url ? { action: { label: t("open"), onClick: () => window.location.assign(url) } } : {}) });
        }
      },
      // A page with nothing else to ask learns here that its session was taken over or expired.
      onUnauthorized(code) {
        if (SIGNED_OUT_REASONS.has(code)) signedOut(code);
      },
      onStatus(s) {
        if (typeof document !== "undefined") document.documentElement.dataset.realtime = s;
      },
    });
  }, [client, status, t]);

  return children;
}
