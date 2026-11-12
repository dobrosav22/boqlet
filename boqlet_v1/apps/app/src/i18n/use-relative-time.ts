"use client";

import { useFormatter, useNow } from "next-intl";

/** "3 minutes ago" in the user's language, re-rendered every minute. */
export function useRelativeTime() {
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  return (date: string | Date) => format.relativeTime(new Date(date), now);
}
