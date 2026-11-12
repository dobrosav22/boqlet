"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRelativeTime } from "@/i18n/use-relative-time";
import type { Schemas } from "@ifc-boq/api";
import { Poster } from "@/components/poster";

/** A stable small number from an id, so each project keeps its composition (design guidelines). */
export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return Math.abs(h);
}

/** A dashboard card: a generated composition, then name, code, status, counts, last activity (F02 §5). */
export function ProjectCard({ org, project }: { org: string; project: Schemas["ProjectListItem"] }) {
  const t = useTranslations("projects.card");
  const relativeTime = useRelativeTime();
  const counts = project.counts ?? {};
  return (
    <Link
      href={`/${org}/projects/${project.id}`}
      className="group flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-3 hover:border-foreground"
      data-testid={`project-card-${project.name}`}
    >
      <Poster variant={hashId(project.id)} className="w-16" />
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-title">{project.name}</span>
          {project.code && <span className="label-caps text-muted-foreground">{project.code}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {project.sample && <span className="label-caps rounded-[var(--radius)] border border-border px-1">{t("sample")}</span>}
          {project.status === "archived" && <span className="label-caps rounded-[var(--radius)] border border-border px-1">{t("archived")}</span>}
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-muted-foreground">
        <div>
          <dt className="label-caps">{t("boqs")}</dt>
          <dd className="tabular-nums text-foreground">{counts.boqs ?? 0}</dd>
        </div>
        <div>
          <dt className="label-caps">{t("questions")}</dt>
          <dd className="tabular-nums text-foreground">{counts.blockingQuestions ?? 0}</dd>
        </div>
        <div>
          <dt className="label-caps">{t("inReview")}</dt>
          <dd className="tabular-nums text-foreground">{counts.revisionsInReview ?? 0}</dd>
        </div>
      </dl>
      {project.lastActivityAt && (
        <p className="text-muted-foreground">{t("lastActivity", { when: relativeTime(project.lastActivityAt) })}</p>
      )}
    </Link>
  );
}
