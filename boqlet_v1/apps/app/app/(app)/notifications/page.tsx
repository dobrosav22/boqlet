"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useMarkAllRead, useMarkRead, useNotificationPages } from "@/api/hooks/notifications";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";
import { useNotificationText } from "@/features/notifications/use-notification-text";
import { cn } from "@/lib/utils";

/** S26: every notification, newest first; unread only on request; mark one or all read (F13). */
export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const message = useErrorMessage();
  const text = useNotificationText();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const pages = useNotificationPages(unreadOnly);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const items = pages.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = pages.data?.pages[0]?.unreadCount ?? 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8" data-testid="notifications-page">
      <Link href="/" className="self-start">
        <Wordmark />
      </Link>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-title flex-1">{t("title")}</h1>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} className="accent-[var(--link)]" data-testid="notifications-unread-only" />
          {t("unreadOnly")}
        </label>
        <Button variant="outline" disabled={unread === 0 || markAll.isPending} onClick={() => markAll.mutate()} data-testid="notifications-page-read-all">
          {t("markAllRead")}
        </Button>
      </div>
      {pages.isError && (
        <p role="alert" className="text-error">
          {message(pages.error)}
        </p>
      )}
      {pages.data && items.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {items.map((n) => (
          <li key={n.id} className="flex items-start gap-3 py-3" data-testid="notification-row" data-read={n.readAt ? "true" : "false"}>
            <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-[var(--link)]")} aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Link href={n.url} className={cn("hover:underline", !n.readAt && "font-semibold")} onClick={() => !n.readAt && markRead.mutate(n.id)}>
                {text(n)}
              </Link>
              <span className="text-muted-foreground">{format.dateTime(new Date(n.createdAt), { dateStyle: "medium", timeStyle: "short" })}</span>
            </div>
            {!n.readAt && (
              <button className="shrink-0 text-link hover:underline" onClick={() => markRead.mutate(n.id)} data-testid="notification-mark-read">
                {t("markRead")}
              </button>
            )}
          </li>
        ))}
      </ul>
      {pages.hasNextPage && (
        <Button variant="outline" className="self-start" onClick={() => void pages.fetchNextPage()} disabled={pages.isFetchingNextPage}>
          {t("more")}
        </Button>
      )}
    </div>
  );
}
