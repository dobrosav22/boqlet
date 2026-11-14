"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { extensions } from "@/extensions";
import { useOrg } from "@/features/orgs/org-context";
import type { OrgAction } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/** Sections and who sees them (billing: owner; usage and audit: owner and admin, F14, S25). */
const SECTIONS: { key: string; action?: OrgAction }[] = [{ key: "general" }, { key: "members" }, { key: "billing", action: "manageBilling" }, { key: "usage", action: "seeUsage" }, { key: "shares", action: "manageShareLinks" }, { key: "audit", action: "seeAudit" }];

export function SettingsNav({ org }: { org: string }) {
  const t = useTranslations("settings");
  const pathname = usePathname();
  const { can } = useOrg();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title">{t("title")}</h1>
      <nav aria-label={t("title")} className="flex gap-6 border-b border-border">
        {[
          ...SECTIONS.filter((s) => !s.action || can(s.action)).map(({ key }) => ({ key, label: t(`nav.${key}`) as ReactNode })),
          // Module sections (`settings.orgSections`) after the core's.
          ...extensions("settings.orgSections")
            .filter((s) => !s.action || can(s.action))
            .map((s) => ({ key: s.path, label: <s.Label /> })),
        ].map(({ key: s, label }) => {
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
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
