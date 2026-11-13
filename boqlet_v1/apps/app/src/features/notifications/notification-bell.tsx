"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMarkAllRead, useMarkRead, useNotifications, type Notification } from "@/api/hooks/notifications";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useNotificationText } from "./use-notification-text";

/** The bell (F13, screens.md "Global chrome"): unread count, the newest notifications, mark read. */
export function NotificationBell() {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const router = useRouter();
  const text = useNotificationText();
  const list = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const unread = list.data?.unreadCount ?? 0;
  const items = list.data?.items ?? [];
  const open = (n: Notification) => {
    if (!n.readAt) markRead.mutate(n.id);
    router.push(n.url);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative flex size-8 items-center justify-center rounded-[var(--radius)] text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label={t("bell", { count: unread })}
        data-testid="notification-bell"
        data-unread={unread}
      >
        <Bell aria-hidden className="size-4" />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-attention px-1 text-[10px] leading-none font-semibold text-on-fill tabular-nums"
            data-testid="notification-count"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>{t("title")}</span>
            {unread > 0 && (
              <button className="font-normal text-link hover:underline" onClick={() => markAll.mutate()} data-testid="notifications-read-all">
                {t("markAllRead")}
              </button>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {items.length === 0 && <p className="px-2 py-3 text-muted-foreground">{t("empty")}</p>}
        {items.map((n) => (
          <DropdownMenuItem key={n.id} onClick={() => open(n)} className="flex flex-col items-start gap-0.5" data-testid="notification-item" data-read={n.readAt ? "true" : "false"}>
            <span className={cn("whitespace-normal", !n.readAt && "font-semibold")}>{text(n)}</span>
            <span className="text-muted-foreground">{format.relativeTime(new Date(n.createdAt))}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/notifications" />} data-testid="notifications-all">
          {t("all")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
