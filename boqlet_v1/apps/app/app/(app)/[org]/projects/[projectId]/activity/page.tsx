"use client";

import { useTranslations } from "next-intl";
import { ActivityList } from "@/features/projects/activity-list";
import { useProjectScope } from "@/features/projects/project-context";

/** S18: the project's activity (leads and approvers). */
export default function ProjectActivityPage() {
  const t = useTranslations("projects.activity");
  const { project, can } = useProjectScope();
  if (!can("seeAudit")) return <p className="text-muted-foreground">{t("notAllowed")}</p>;
  return <ActivityList projectId={project.id} />;
}
