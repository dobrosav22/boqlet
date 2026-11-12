"use client";

import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { keys } from "@/api/keys";
import { authAdapter, useSession } from "@/auth";
import { invalidationsFor } from "./invalidation";
import { connectRealtime } from "./sse";

/** Opens the tab's SSE connection while signed in and turns events into query refetches. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    return connectRealtime({
      getToken: () => authAdapter.getAccessToken(),
      onEvent(e) {
        if (e.event === "job.progress" && typeof e.data.jobId === "string") {
          client.setQueryData(keys.jobProgress(e.data.jobId), e.data);
          return;
        }
        for (const queryKey of invalidationsFor(e)) void client.invalidateQueries({ queryKey });
      },
      onStatus(s) {
        if (typeof document !== "undefined") document.documentElement.dataset.realtime = s;
      },
    });
  }, [client, status]);

  return children;
}
