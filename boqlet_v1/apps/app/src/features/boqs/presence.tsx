"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import { useMe } from "@/api/hooks/me";
import { API_BASE_URL } from "@/config";
import { authAdapter } from "@/auth";

export type BoqPresence = Schemas["BoqPresence"];
const HEARTBEAT_MS = 20_000;

interface PresenceScope {
  /** The others in this BoQ (not me), with the line each is editing. */
  others: BoqPresence["users"];
  /** Tell the others which line I'm editing (`null`: none). */
  setLineKey: (key: string | null) => void;
}

const PresenceContext = createContext<PresenceScope | null>(null);

/** The presence of the BoQ the sheet is in, if a workspace provides it (F06 §14). */
export const useBoqPresence = () => useContext(PresenceContext);

/**
 * F06 §14, P31: I'm in this BoQ while the workspace is open: a heartbeat every 20 s and on each
 * change of the line I'm editing; leaving (unmount, closing the tab) ends it. Who else is in it comes
 * back from the heartbeat and as SSE `boq.presence` (stored in the query cache by the realtime provider).
 */
export function BoqPresenceProvider({ boqId, children }: { boqId: string; children: ReactNode }) {
  const client = useQueryClient();
  const me = useMe();
  const [lineKey, setLineKey] = useState<string | null>(null);
  const lineRef = useRef(lineKey);
  useLayoutEffect(() => {
    lineRef.current = lineKey;
  }, [lineKey]);
  const presence = useQuery<BoqPresence>({ queryKey: keys.presence(boqId), queryFn: () => client.getQueryData<BoqPresence>(keys.presence(boqId)) ?? { boqId, users: [] }, staleTime: Infinity });

  useEffect(() => {
    let alive = true;
    const beat = async () => {
      try {
        const { data } = await api.PUT("/boqs/{boqId}/presence", { params: { path: { boqId } }, body: { lineKey: lineRef.current } });
        if (alive && data) client.setQueryData(keys.presence(boqId), data);
      } catch {
        // Presence is a hint (storage-jobs-realtime.md): a missed heartbeat only hides me for a moment.
      }
    };
    void beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    const leave = () => {
      const token = authAdapter.getAccessToken();
      void Promise.resolve(token).then((t) =>
        fetch(`${API_BASE_URL}/boqs/${boqId}/presence`, { method: "DELETE", keepalive: true, headers: t ? { Authorization: `Bearer ${t}` } : {} }).catch(() => {}),
      );
    };
    window.addEventListener("pagehide", leave);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [boqId, client]);

  // A new line being edited is told at once, not at the next heartbeat.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void api.PUT("/boqs/{boqId}/presence", { params: { path: { boqId } }, body: { lineKey } }).then(({ data }) => data && client.setQueryData(keys.presence(boqId), data), () => {});
  }, [lineKey, boqId, client]);

  const myId = me.data?.user.id;
  const others = useMemo(() => (presence.data?.users ?? []).filter((u) => u.userId !== myId), [presence.data, myId]);
  const scope = useMemo(() => ({ others, setLineKey }), [others]);
  return <PresenceContext.Provider value={scope}>{children}</PresenceContext.Provider>;
}

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** The others' avatars in the workspace header (F06 §14). */
export function PresenceAvatars() {
  const t = useTranslations("boqs.presence");
  const scope = useBoqPresence();
  const others = scope?.others ?? [];
  if (others.length === 0) return null;
  return (
    <ul className="flex items-center gap-1" aria-label={t("label")} data-testid="presence" data-count={others.length}>
      {others.map((u) => (
        <li
          key={u.userId}
          title={u.lineKey ? t("editing", { name: u.name }) : t("viewing", { name: u.name })}
          className="grid size-6 place-items-center rounded-full bg-[var(--orange)] text-label text-[var(--paper)]"
          data-testid="presence-user"
          data-name={u.name}
        >
          <span aria-hidden>{initialsOf(u.name)}</span>
          <span className="sr-only">{u.name}</span>
        </li>
      ))}
    </ul>
  );
}
