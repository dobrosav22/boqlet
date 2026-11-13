"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOrg } from "@/features/orgs/org-context";
import type { OrgAction } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/** Sections and who sees them (billing: owner; usage: owner and admin, F14). */
const SECTIONS: { key: string; action?: OrgAction }[] = [{ key: "general" }, { key: "members" }, { key: "billing", action: "manageBilling" }, { key: "usage", action: "seeUsage" }];

export function SettingsNav({ org }: { org: string }) {
  const t = useTranslations("settings");
  const pathname = usePathname();
  const { can } = useOrg();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title">{t("title")}</h1>
      <nav aria-label={t("title")} className="flex gap-6 border-b border-border">
        {SECTIONS.filter((s) => !s.action || can(s.action)).map(({ key: s }) => {
          const href = `/${org}/settings/${s}`;
          const active = pathname === href;
          return (
            <Link
              key={s}
              href={href}
              aria-current={active ? "page" : undefined}
              data-testid={`settings-${s}`}
              className={cn(
                "label-caps -mb-px border-b-2 border-transparent pb-2 text-muted-foreground hover:text-foreground",
                active && "border-link text-foreground",
              )}
            >
              {t(`nav.${s}`)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
