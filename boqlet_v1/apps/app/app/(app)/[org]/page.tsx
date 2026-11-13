"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRelativeTime } from "@/i18n/use-relative-time";
import { useAttention, useProjects } from "@/api/hooks/projects";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Poster } from "@/components/poster";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/features/orgs/org-context";
import { ProjectCard } from "@/features/projects/project-card";
import { useCreateSample } from "@/features/projects/create-sample";

/**
 * S05: what needs me, and my projects (F02 §5). Until the org's setup is finished (F16, P18) the
 * people who can finish it are sent to the wizard; members see that it isn't finished yet.
 */
export default function DashboardPage() {
  const { org, can } = useOrg();
  const router = useRouter();
  const unfinished = org.setup?.status !== "done";
  const gate = unfinished && can("finishSetup");
  useEffect(() => {
    if (gate) router.replace(`/${org.slug}/setup`);
  }, [gate, org.slug, router]);
  if (gate) return <div aria-busy="true" className="min-h-40" />;
  return <Dashboard unfinished={unfinished} />;
}

function Dashboard({ unfinished }: { unfinished: boolean }) {
  const ts = useTranslations("setup");
  const t = useTranslations("projects.dashboard");
  const relativeTime = useRelativeTime();
  const message = useErrorMessage();
  const { org, can } = useOrg();
  const projects = useProjects(org.id, { status: "active" });
  const attention = useAttention(org.id);
  const sample = useCreateSample(org);

  return (
    <div className="flex flex-col gap-10">
      {unfinished && (
        <p className="rounded-[var(--radius)] border border-border bg-muted px-3 py-2" role="status" data-testid="setup-not-finished">
          {ts("notFinished")}
        </p>
      )}
      <section className="flex flex-col gap-3" data-testid="needs-you">
        <h2 className="label-caps">{t("needsYou")}</h2>
        {attention.data?.length === 0 && <p className="text-muted-foreground">{t("nothingNeedsYou")}</p>}
        <ul className="flex flex-col divide-y divide-border">
          {attention.data?.map((item) => (
            <li key={`${item.kind}-${item.url}`} className="flex items-center gap-4 py-2">
              <span className="flex-1">{item.title}</span>
              <span className="text-muted-foreground">{item.projectName}</span>
              {item.at && <span className="text-muted-foreground tabular-nums">{relativeTime(item.at)}</span>}
              <Button variant="outline" render={<Link href={item.url} />} nativeButton={false}>
                {t("open")}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <h2 className="label-caps flex-1">{t("projects")}</h2>
          {can("createProjects") && (
            <Button render={<Link href={`/${org.slug}/projects/new`} />} nativeButton={false} data-testid="new-project">
              {t("newProject")}
            </Button>
          )}
        </div>
        {projects.isError && (
          <p role="alert" className="text-error">
            {message(projects.error)}
          </p>
        )}
        {projects.isPending && <div className="h-40 animate-pulse rounded-[var(--radius)] bg-muted" aria-busy="true" />}
        {projects.data?.length === 0 && (
          <div className="grid grid-cols-1 items-center gap-8 rounded-[var(--radius)] border border-border p-8 md:grid-cols-[1fr_200px]" data-testid="empty-dashboard">
            <div className="flex flex-col gap-4">
              <h3 className="display text-display-sm">{t("emptyTitle")}</h3>
              <p className="prose-text text-muted-foreground">{t("emptyBody")}</p>
              <div className="flex flex-wrap gap-3">
                {can("createProjects") && (
                  <Button render={<Link href={`/${org.slug}/projects/new`} />} nativeButton={false}>
                    {t("createFirst")}
                  </Button>
                )}
                <Button variant="outline" onClick={() => sample.mutate()} disabled={sample.isPending} data-testid="try-sample">
                  {t("trySample")}
                </Button>
              </div>
            </div>
            <Poster variant={2} className="hidden w-full md:grid" />
          </div>
        )}
        {!!projects.data?.length && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4" data-testid="project-cards">
            {projects.data.map((p) => (
              <ProjectCard key={p.id} org={org.slug} project={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
