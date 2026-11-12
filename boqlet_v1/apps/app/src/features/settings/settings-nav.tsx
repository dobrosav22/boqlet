"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const SECTIONS = ["general", "members"] as const;

export function SettingsNav({ org }: { org: string }) {
  const t = useTranslations("settings");
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title">{t("title")}</h1>
      <nav aria-label={t("title")} className="flex gap-6 border-b border-border">
        {SECTIONS.map((s) => {
          const href = `/${org}/settings/${s}`;
          const active = pathname === href;
          return (
            <Link
              key={s}
              href={href}
              aria-current={active ? "page" : undefined}
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
