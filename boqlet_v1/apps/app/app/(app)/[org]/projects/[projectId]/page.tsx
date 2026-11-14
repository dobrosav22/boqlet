"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useBoqs } from "@/api/hooks/boqs";
import { useModels } from "@/api/hooks/models";
import { DimensionRule } from "@/components/dimension-rule";
import { useOrg } from "@/features/orgs/org-context";
import { useProjectScope } from "@/features/projects/project-context";
import { ActivityList } from "@/features/projects/activity-list";
import { extensions } from "@/extensions";

/** S07: models, BoQs and recent activity of the project (F02 §6). */
export default function ProjectOverviewPage() {
  const t = useTranslations("projects.overview");
  const tm = useTranslations("models");
  const tb = useTranslations("boqs");
  const { org } = useOrg();
  const { project, can } = useProjectScope();
  const models = useModels(project.id);
  const boqs = useBoqs(project.id);
  const base = `/${org.slug}/projects/${project.id}`;
  const activeBoqs = (boqs.data ?? []).filter((b) => !b.archived);
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
      <section className="flex flex-col gap-3" data-testid="overview-models">
        <h2 className="label-caps">{t("models")}</h2>
        {models.data?.length ? (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {models.data.map((m) => (
              <li key={m.id} className="flex items-baseline gap-3 py-2">
                <Link href={`${base}/models/${m.id}`} className="flex-1 hover:underline">
                  {m.name}
                </Link>
                {m.latestVersion && (
                  <span className="text-muted-foreground">
                    {tm("versions.v", { number: m.latestVersion.number })} · {tm(`status.${m.latestVersion.status}`)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="text-muted-foreground">{t("noModels")}</p>
            <DimensionRule className="max-w-48" />
          </>
        )}
        <Link href={`${base}/models`} className="text-link hover:underline">
          {t("allModels")}
        </Link>
      </section>
      <section className="flex flex-col gap-3" data-testid="overview-boqs">
        <h2 className="label-caps">{t("boqs")}</h2>
        {activeBoqs.length ? (
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {activeBoqs.map((b) => {
              const run = b.currentRevision.currentRun;
              return (
                <li key={b.id} className="flex items-baseline gap-3 py-2">
                  <Link href={`${base}/boqs/${b.id}`} className="flex-1 hover:underline">
                    {b.name}
                  </Link>
                  {b.newModelVersionsAvailable && <span className="label-caps text-muted-foreground">{tb("newVersion.listBadge")}</span>}
                  <span className="text-muted-foreground">
                    {tb(`status.${b.status === "confirmed" ? "confirmed" : b.currentRevision.status}`)} · {run ? tb(`run.status.${run.status}`) : tb("list.notGenerated")}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <>
            <p className="text-muted-foreground">{t("noBoqs")}</p>
            <DimensionRule className="max-w-48" />
          </>
        )}
        <Link href={`${base}/boqs`} className="text-link hover:underline">
          {t("allBoqs")}
        </Link>
      </section>
      {can("seeAudit") && (
        <section className="flex flex-col gap-3 lg:col-span-2">
          <h2 className="label-caps">{t("activity")}</h2>
          <ActivityList projectId={project.id} limit={10} />
        </section>
      )}
      {/* Module cards (`project.overviewCards`, P36). */}
      {extensions("project.overviewCards").map((c) => (
        <c.Card key={c.id} projectId={project.id} />
      ))}
    </div>
  );
}
