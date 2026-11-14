"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { extensions } from "@/extensions";
import { useOrg } from "@/features/orgs/org-context";
import { cn } from "@/lib/utils";

/** The org's left navigation (screens.md "Global chrome"); modules add entries below the core's (`nav.orgItems`). */
const ITEMS = [
  { key: "dashboard", href: "" },
  { key: "projects", href: "/projects" },
  { key: "library", href: "/library" },
  { key: "settings", href: "/settings" },
] as const;

export function LeftNav({ org }: { org: string }) {
  const t = useTranslations("shell");
  const pathname = usePathname();
  const scope = useOrg();
  const base = `/${org}`;
  const items = [
    ...ITEMS.map(({ key, href }) => ({ id: key, href, label: t(`nav.${key}`) as ReactNode })),
    ...extensions("nav.orgItems")
      .filter((e) => !e.visible || e.visible(scope))
      .map((e) => ({ id: `module:${e.id}`, href: e.href, label: <e.Label /> })),
  ];
  return (
    <nav aria-label={t("mainNav")} className="flex flex-col gap-px py-3">
      {items.map(({ id, href, label }) => {
        const target = base + href;
        const active = href === "" ? pathname === base : pathname === target || pathname.startsWith(`${target}/`);
        return (
          <Link
            key={id}
            href={target}
            aria-current={active ? "page" : undefined}
            data-testid={`nav-${id}`}
            className={cn(
              "flex h-row items-center border-l-2 border-transparent px-4 text-ui text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              active && "border-link bg-selection text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
