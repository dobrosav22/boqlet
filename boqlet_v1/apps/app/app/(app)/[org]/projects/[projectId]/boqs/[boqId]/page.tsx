"use client";

import { use } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useBoq, useRuns, type Run } from "@/api/hooks/boqs";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { DimensionRule } from "@/components/dimension-rule";
import { BoqHeader } from "@/features/boqs/boq-header";
import { RunHistory } from "@/features/boqs/run-history";
import { SetupTab } from "@/features/boqs/setup-tab";
import { LogTab } from "@/features/boq-sheet/log-tab";
import { Sheet } from "@/features/boq-sheet/sheet";
import { useOrg } from "@/features/orgs/org-context";
import { QuestionsTab } from "@/features/questions/questions-tab";
import { useProjectScope } from "@/features/projects/project-context";
import { cn } from "@/lib/utils";

const TABS = ["sheet", "questions", "log", "setup", "versions"] as const;
type Tab = (typeof TABS)[number];

/**
 * S12: the BoQ workspace: header, Sheet (FE-009), Questions (FE-010), Log, Setup and the run
 * history (FE-008).
 */
export default function BoqWorkspacePage({ params }: { params: Promise<{ boqId: string }> }) {
  const { boqId } = use(params);
  const t = useTranslations("boqs");
  const message = useErrorMessage();
  const { org } = useOrg();
  const { project, can } = useProjectScope();
  const search = useSearchParams();
  const boq = useBoq(boqId);
  const runs = useRuns(boq.data?.currentRevision.id);
  const requested = search.get("tab") as Tab | null;
  const tab: Tab = requested && (TABS as readonly string[]).includes(requested) ? requested : "sheet";
  const base = `/${org.slug}/projects/${project.id}/boqs/${boqId}`;

  if (boq.isError) return <p role="alert" className="text-error">{message(boq.error)}</p>;
  if (!boq.data) return <div className="h-40" aria-busy="true" />;
  const current = boq.data.currentRevision.currentRun;
  return (
    <div className="flex flex-col gap-6" data-testid="boq-workspace">
      <BoqHeader boq={boq.data} runs={runs.data} base={base} canArchive={can("archive")} />
      <nav aria-label={t("tabs.label")} className="flex gap-6 border-b border-border">
        {TABS.map((key) => (
          <Link
            key={key}
            href={`${base}?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={cn("label-caps -mb-px border-b-2 border-transparent pb-2 text-muted-foreground hover:text-foreground", tab === key && "border-link text-foreground")}
            data-testid={`tab-${key}`}
          >
            {t(`tabs.${key}`)}
          </Link>
        ))}
      </nav>
      {tab === "sheet" && (current ? <Sheet key={current.id} run={current} boq={boq.data} /> : <RunFigures run={current} />)}
      {tab === "log" && <LogTab key={current?.id ?? "none"} run={current} />}
      {tab === "questions" && <QuestionsTab boq={boq.data} />}
      {tab === "setup" && <SetupTab boq={boq.data} orgId={org.id} />}
      {tab === "versions" && <RunHistory runs={runs.data} currentRunId={current?.id} />}
    </div>
  );
}

/** Before the first run: what to do; the sheet appears once a run is complete. */
function RunFigures({ run }: { run: Run | undefined }) {
  const t = useTranslations("boqs.sheet");
  const format = useFormatter();
  if (!run?.stats) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground">{t("empty")}</p>
        <DimensionRule className="max-w-48" />
      </div>
    );
  }
  const s = run.stats;
  const figures: [string, string][] = [
    [t("lines"), format.number(s.lines ?? 0)],
    [t("flagged"), format.number(s.flaggedLines ?? 0)],
    [t("elements"), format.number(s.elements ?? 0)],
    [t("measured"), format.number(s.measuredElements ?? 0)],
    [t("questions"), format.number(s.questions ?? 0)],
    [t("blocking"), format.number(s.blockingQuestions ?? 0)],
    [t("warnings"), format.number(s.warnings ?? 0)],
    [t("duration"), t("seconds", { s: format.number((s.durationMs ?? 0) / 1000, { maximumFractionDigits: 1 }) })],
  ];
  return (
    <dl className="grid max-w-3xl grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-6 gap-y-4" data-testid="run-figures">
      {figures.map(([label, value]) => (
        <div key={label} className="flex flex-col">
          <dt className="label-caps text-muted-foreground">{label}</dt>
          <dd className="text-title tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
