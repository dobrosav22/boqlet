"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMe } from "@/api/hooks/me";
import { NotFoundView } from "@/components/errors/not-found-view";
import { ThemeSwitch } from "@/components/shell/theme-switch";
import { UserMenu } from "@/components/shell/user-menu";
import { Wordmark } from "@/components/shell/wordmark";
import { cn } from "@/lib/utils";

const SECTIONS = ["overview", "funnel", "orgs", "users", "health"] as const;
const href = (s: (typeof SECTIONS)[number]) => (s === "overview" ? "/admin" : `/admin/${s}`);

/**
 * S36's own layout (F19), outside any org: a top bar and the console's sections. Only platform
 * admins see it; for anyone else it is the not-found page, as the API answers 404 (BR-57).
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations("admin");
  const me = useMe();
  const pathname = usePathname();
  if (me.isPending) return <div className="min-h-dvh" aria-busy="true" />;
  if (me.data?.user.platformRole !== "admin")
    return (
      <main className="mx-auto max-w-3xl px-8">
        <NotFoundView />
      </main>
    );
  return (
    <div className="grid min-h-dvh grid-cols-[208px_1fr] grid-rows-[48px_1fr]" data-testid="admin-shell">
      <header className="col-span-2 flex items-center gap-4 border-b border-border px-4">
        <Link href="/admin">
          <Wordmark />
        </Link>
        <span className="h-5 w-px bg-border" aria-hidden />
        <span className="label-caps text-muted-foreground">{t("title")}</span>
        <div className="flex-1" />
        <ThemeSwitch />
        <UserMenu />
      </header>
      <aside className="border-r border-border">
        <nav aria-label={t("nav.label")} className="flex flex-col gap-px py-3">
          {SECTIONS.map((s) => {
            const target = href(s);
            const active = s === "overview" ? pathname === "/admin" : pathname.startsWith(target);
            return (
              <Link
                key={s}
                href={target}
                aria-current={active ? "page" : undefined}
                data-testid={`admin-nav-${s}`}
                className={cn(
                  "flex h-row items-center border-l-2 border-transparent px-4 text-ui text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  active && "border-link bg-selection text-foreground",
                )}
              >
                {t(`nav.${s}`)}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main id="main" className="min-w-0 px-8 py-6">
        {children}
      </main>
    </div>
  );
}
