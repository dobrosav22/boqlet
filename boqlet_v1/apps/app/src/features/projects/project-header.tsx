"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useProjectScope } from "./project-context";

/** The project's name, the read-only banner when archived, and the project sub-navigation (screens.md). */
const SECTIONS = [
  { key: "overview", path: "" },
  { key: "models", path: "/models" },
  { key: "boqs", path: "/boqs" },
  { key: "decisions", path: "/decisions" },
  { key: "library", path: "/library" },
  { key: "activity", path: "/activity", needs: "seeAudit" as const },
  { key: "settings", path: "/settings" },
];

export function ProjectHeader({ org }: { org: string }) {
  const t = useTranslations("projects.header");
  const { project, can } = useProjectScope();
  const pathname = usePathname();
  const base = `/${org}/projects/${project.id}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <h1 className="text-title" data-testid="project-title">
          {project.name}
        </h1>
        {project.code && <span className="label-caps text-muted-foreground">{project.code}</span>}
      </div>
      {project.status === "archived" && (
        <p className="rounded-[var(--radius)] border border-border bg-muted px-3 py-2" role="status" data-testid="archived-banner">
          {t("archived")}
        </p>
      )}
      <nav aria-label={t("nav")} className="flex gap-6 border-b border-border">
        {SECTIONS.filter((s) => !s.needs || can(s.needs)).map((s) => {
          const href = base + s.path;
          const active = s.path === "" ? pathname === base : pathname.startsWith(href);
          return (
            <Link
              key={s.key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn("label-caps -mb-px border-b-2 border-transparent pb-2 text-muted-foreground hover:text-foreground", active && "border-link text-foreground")}
            >
              {t(`sections.${s.key}`)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
