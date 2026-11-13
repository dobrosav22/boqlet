"use client";

import { useTranslations } from "next-intl";

/** A notification's text from its kind and params (F13: the backend never stores rendered text). */
export function useNotificationText() {
  const t = useTranslations("notifications");
  return (n: { kind: string; params?: Record<string, unknown> }) => {
    const key = `kinds.${n.kind.replaceAll(".", "_")}`;
    const params = Object.fromEntries(Object.entries(n.params ?? {}).map(([k, v]) => [k, typeof v === "number" ? v : String(v ?? "")]));
    return t.has(key) ? t(key, params) : n.kind;
  };
}
