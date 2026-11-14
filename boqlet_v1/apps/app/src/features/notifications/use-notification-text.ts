"use client";

import { useTranslations } from "next-intl";
import { extensions } from "@/extensions";

/** A notification's text from its kind and params (F13: the backend never stores rendered text). */
export function useNotificationText() {
  const t = useTranslations("notifications");
  // A module's kinds (`notifications.kinds`, P36) read from the module's own namespace.
  const root = useTranslations();
  return (n: { kind: string; params?: Record<string, unknown> }) => {
    const params = Object.fromEntries(Object.entries(n.params ?? {}).map(([k, v]) => [k, typeof v === "number" ? v : String(v ?? "")]));
    const ext = extensions("notifications.kinds").find((k) => k.kind === n.kind);
    if (ext) return root.has(ext.messageKey) ? root(ext.messageKey, params) : n.kind;
    const key = `kinds.${n.kind.replaceAll(".", "_")}`;
    return t.has(key) ? t(key, params) : n.kind;
  };
}
