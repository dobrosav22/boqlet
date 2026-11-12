"use client";

import { useTranslations } from "next-intl";
import { useProjectScope } from "@/features/projects/project-context";
import { ActivityList } from "@/features/projects/activity-list";
import { DimensionRule } from "@/components/dimension-rule";

/** S07: models, BoQs and recent activity of the project (F02 §6). Models and BoQs fill in with FE-007, FE-008. */
export default function ProjectOverviewPage() {
  const t = useTranslations("projects.overview");
  const { project, can } = useProjectScope();
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
      <section className="flex flex-col gap-3" data-testid="overview-models">
        <h2 className="label-caps">{t("models")}</h2>
        <p className="text-muted-foreground">{t("noModels")}</p>
        <DimensionRule className="max-w-48" />
      </section>
      <section className="flex flex-col gap-3" data-testid="overview-boqs">
        <h2 className="label-caps">{t("boqs")}</h2>
        <p className="text-muted-foreground">{t("noBoqs")}</p>
        <DimensionRule className="max-w-48" />
      </section>
      {can("seeAudit") && (
        <section className="flex flex-col gap-3 lg:col-span-2">
          <h2 className="label-caps">{t("activity")}</h2>
          <ActivityList projectId={project.id} limit={10} />
        </section>
      )}
    </div>
  );
}
