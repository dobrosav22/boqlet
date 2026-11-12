import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { APP_NAME } from "@/config";
import { LeftNav } from "./left-nav";
import { ThemeSwitch } from "./theme-switch";
import { UserMenu } from "./user-menu";
import { Wordmark } from "./wordmark";

/**
 * The chrome of every `/{org}` route: a top bar with the wordmark (org switcher, search,
 * notifications and the user menu join in FE-004…FE-006, FE-034) and the left navigation.
 */
export async function AppShell({ org, children }: { org: string; children: ReactNode }) {
  const t = await getTranslations("shell");
  return (
    <div className="grid min-h-dvh grid-cols-[208px_1fr] grid-rows-[48px_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:px-2"
      >
        {t("skipToContent")}
      </a>
      <header className="col-span-2 flex items-center gap-4 border-b border-border px-4">
        <Link href={`/${org}`} aria-label={t("home", { appName: APP_NAME })} data-testid="wordmark">
          <Wordmark />
        </Link>
        <div className="flex-1" />
        <ThemeSwitch />
        <UserMenu />
      </header>
      <aside className="border-r border-border">
        <LeftNav org={org} />
      </aside>
      <main id="main" className="min-w-0 px-8 py-6">
        {children}
      </main>
    </div>
  );
}
