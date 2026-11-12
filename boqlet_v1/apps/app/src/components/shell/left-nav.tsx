"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** The org's left navigation (screens.md "Global chrome"). Modules add entries in FE-039. */
const ITEMS = [
  { key: "dashboard", href: "" },
  { key: "projects", href: "/projects" },
  { key: "library", href: "/library" },
  { key: "settings", href: "/settings" },
] as const;

export function LeftNav({ org }: { org: string }) {
  const t = useTranslations("shell");
  const pathname = usePathname();
  const base = `/${org}`;
  return (
    <nav aria-label={t("mainNav")} className="flex flex-col gap-px py-3">
      {ITEMS.map(({ key, href }) => {
        const target = base + href;
        const active = href === "" ? pathname === base : pathname === target || pathname.startsWith(`${target}/`);
        return (
          <Link
            key={key}
            href={target}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-row items-center border-l-2 border-transparent px-4 text-ui text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              active && "border-link bg-selection text-foreground",
            )}
          >
            {t(`nav.${key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
