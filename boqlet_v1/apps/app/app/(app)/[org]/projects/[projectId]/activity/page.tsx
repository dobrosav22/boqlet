"use client";

import { useTranslations } from "next-intl";
import { AuditView } from "@/features/audit/audit-view";
import { useProjectScope } from "@/features/projects/project-context";

/** S18: the project's activity (leads and approvers), with filters and CSV (F09 "Audit log", F12). */
export default function ProjectActivityPage() {
  const t = useTranslations("projects.activity");
  const { project, can } = useProjectScope();
  if (!can("seeAudit")) return <p className="text-muted-foreground">{t("notAllowed")}</p>;
  return <AuditView scope={{ kind: "project", projectId: project.id }} fileName={`${(project.code ?? project.name).replace(/[^\w.-]+/g, "-")}_audit.csv`} />;
}
