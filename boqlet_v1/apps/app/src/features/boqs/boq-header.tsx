"use client";

import Link from "next/link";
import { Check, Ellipsis } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import { useGenerate, type Boq, type Run } from "@/api/hooks/boqs";
import { useQuestions } from "@/api/hooks/decisions";
import { useJobProgress } from "@/api/hooks/models";
import { DimensionRule } from "@/components/dimension-rule";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRelativeTime } from "@/i18n/use-relative-time";
import { cn } from "@/lib/utils";
import { counts } from "@/features/questions/model";
import { useRevisions } from "@/api/hooks/diffs";
import { SaveVersionDialog, SubmitDialog, type SaveMode } from "@/features/versions/version-dialogs";
import { ReviewStrip } from "@/features/versions/review-strip";
import { NewModelVersions } from "./new-model-versions";
import { ReopenBoqDialog } from "./reopen-boq-dialog";
import { ShareDialog } from "@/features/shares/share-dialog";
import { headerState, saveBlockedReason } from "./run-state";

export function Tag({ children, filled, className, ...rest }: { children: React.ReactNode; filled?: boolean; className?: string; "data-testid"?: string }) {
  return (
    <span className={cn("label-caps rounded-[var(--radius)] border border-foreground px-1", filled && "bg-foreground text-background", className)} {...rest}>
      {children}
    </span>
  );
}

/**
 * The BoQ workspace header (S12, F04 "States shown in the BoQ workspace header"): name and state,
 * the run's progress or result, Generate / Cancel / Retry, Save version (blocked while inputs are
 * pending, BR-22), "N answers not applied yet" (F05 §3), and archive / restore for the lead.
 */
export function BoqHeader({ boq, runs, base, canArchive, approval }: { boq: Boq; runs: Run[] | undefined; base: string; canArchive: boolean; approval: boolean }) {
  const t = useTranslations("boqs");
  const relative = useRelativeTime();
  const message = useErrorMessage();
  const client = useQueryClient();
  const revision = boq.currentRevision;
  const can = (key: string) => revision.permissions[key] === true;
  const state = headerState(boq, runs);
  const generate = useGenerate(revision.id, boq.id);
  const activeJobId = state.kind === "active" ? state.run.jobId : undefined;
  const progress = useJobProgress(activeJobId);
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: keys.boq(boq.id) }), client.invalidateQueries({ queryKey: keys.runs(revision.id) })]);

  const cancel = useMutation({
    mutationFn: async () => api.POST("/jobs/{jobId}/cancel", { params: { path: { jobId: activeJobId! } } }),
    onSuccess: refresh,
    onError: () => {},
  });
  const archive = useMutation({
    mutationFn: async (archived: boolean) =>
      archived ? api.POST("/boqs/{boqId}/archive", { params: { path: { boqId: boq.id } } }) : api.PATCH("/boqs/{boqId}", { params: { path: { boqId: boq.id } }, body: { archived: false } }),
    onSuccess: () => Promise.all([refresh(), client.invalidateQueries({ queryKey: keys.boqs(boq.projectId) })]),
    onError: () => {},
  });
  // F09: save version (approval off), submit for review / save the approved version (on), confirm, reopen.
  const [dialog, setDialog] = useState<SaveMode | "submit" | "reopen" | "share" | null>(null);
  const revisions = useRevisions(boq.id);
  const lastSaved = boq.latestIssuedRevisionId && boq.latestIssuedRevisionId !== revision.id ? revisions.data?.find((r) => r.id === boq.latestIssuedRevisionId)?.label : undefined;

  const blocked = saveBlockedReason(boq);
  const error = generate.error ?? cancel.error ?? archive.error;
  const stage = progress.data?.stage;
  // F05 §3: answers wait for a regenerate; the count comes from the current run's questions.
  const answersPending = revision.pendingChanges.includes("decisions");
  const questions = useQuestions(answersPending ? revision.currentRun?.id : undefined);
  const notApplied = answersPending ? counts(questions.data ?? []).notApplied : 0;
  const otherPending = revision.pendingChanges.filter((k) => k !== "decisions" || notApplied === 0);

  return (
    <div className="flex flex-col gap-4" data-testid="boq-header" data-state={state.kind}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-title" data-testid="boq-title">
          {boq.name}
        </h2>
        <Tag data-testid="revision-status">
          {revision.label} · {t(`status.${revision.status}`)}
          {lastSaved ? ` · ${t("versions.lastSaved", { label: lastSaved })}` : ""}
        </Tag>
        {boq.status === "confirmed" && <Tag filled>{t("status.confirmed")}</Tag>}
        {boq.archived && <Tag className="border-muted-foreground text-muted-foreground">{t("status.archived")}</Tag>}
        <div className="ml-auto flex items-center gap-2">
          {state.kind === "active" && activeJobId && can("editBoqs") && (
            <Button variant="outline" onClick={() => cancel.mutate()} disabled={cancel.isPending} data-testid="cancel-run">
              {t("actions.cancel")}
            </Button>
          )}
          {state.kind === "failed" && can("editBoqs") && (
            <Button onClick={() => generate.mutate()} disabled={generate.isPending} data-testid="retry-run">
              {t("actions.retry")}
            </Button>
          )}
          {state.kind !== "active" && state.kind !== "failed" && can("editBoqs") && (
            <Button
              variant={state.kind === "none" || revision.pendingChanges.length ? "default" : "outline"}
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              data-testid="generate"
            >
              {state.kind === "none" ? t("actions.generate") : t("actions.regenerate")}
            </Button>
          )}
          {(can("saveVersion") || can("submit")) && (
            <Button
              variant="outline"
              onClick={() => setDialog(can("submit") ? "submit" : "save")}
              disabled={blocked !== null}
              title={blocked === "pending" ? t("actions.saveBlockedPending") : blocked === "noRun" ? t("actions.saveBlockedNoRun") : undefined}
              data-testid={can("submit") ? "submit-for-review" : "save-version"}
            >
              {can("submit") ? t("actions.submit") : t("actions.saveVersion")}
            </Button>
          )}
          {can("saveApproved") && (
            <Button onClick={() => setDialog("saveApproved")} data-testid="save-approved">
              {t("actions.saveApproved")}
            </Button>
          )}
          {boq.status === "confirmed" && can("reopen") && (
            <Button variant="outline" onClick={() => setDialog("reopen")} data-testid="reopen-boq">
              {t("actions.reopen")}
            </Button>
          )}
          {can("share") && !boq.archived && (
            <Button variant="outline" onClick={() => setDialog("share")} data-testid="share-boq">
              {t("actions.share")}
            </Button>
          )}
          {(canArchive || can("confirm")) && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" aria-label={t("actions.more")} data-testid="boq-menu" />}>
                <Ellipsis aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {can("confirm") && (
                  <DropdownMenuItem onClick={() => setDialog("confirm")} data-testid="confirm-boq">
                    {t("actions.confirm")}
                  </DropdownMenuItem>
                )}
                {!canArchive ? null : boq.archived ? (
                  <DropdownMenuItem onClick={() => archive.mutate(false)} data-testid="restore-boq">
                    {t("actions.restore")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => archive.mutate(true)} data-testid="archive-boq">
                    {t("actions.archive")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {boq.archived && (
        <p className="rounded-[var(--radius)] border border-border bg-muted px-3 py-2" role="status">
          {t("actions.archivedBanner")}
        </p>
      )}

      <div aria-live="polite" className="flex flex-col gap-2" data-testid="run-state">
        {state.kind === "none" && <p className="text-muted-foreground">{t("run.notGenerated")}</p>}
        {state.kind === "active" && (
          <DimensionRule progress={(progress.data?.pct ?? 0) / 100} label={stage ? t(`run.stages.${stage}`) : t("run.waiting")} className="max-w-xl" />
        )}
        {state.kind === "failed" && (
          <div className="flex flex-col gap-1 border-l-2 border-[var(--status-error)] pl-3">
            <p role="alert" className="text-error" data-testid="run-error">
              {t("run.failed", { message: state.run.error?.code && t.has(`run.errors.${state.run.error.code}`) ? t(`run.errors.${state.run.error.code}`) : (state.run.error?.message ?? "") })}
            </p>
            {state.current && <p className="text-muted-foreground">{t("run.lastGood")}</p>}
          </div>
        )}
        {(state.kind === "complete" || state.kind === "needs_input" || ((state.kind === "active" || state.kind === "failed") && state.current)) && (
          <CurrentRunSummary run={state.kind === "complete" || state.kind === "needs_input" ? state.current : state.current!} base={base} relative={relative} />
        )}
        {notApplied > 0 && revision.currentRun && (
          <p className="flex flex-wrap items-center gap-x-3 border-l-2 border-[var(--status-attention)] pl-3" role="status" data-testid="answers-pending">
            <span>{t("run.answersPending", { count: notApplied })}</span>
            {can("editBoqs") && state.kind !== "active" && (
              <button type="button" className="text-link hover:underline" onClick={() => generate.mutate()} disabled={generate.isPending} data-testid="answers-regenerate">
                {t("actions.regenerate")}
              </button>
            )}
          </p>
        )}
        {otherPending.length > 0 && revision.currentRun && (
          <p className="border-l-2 border-[var(--status-attention)] pl-3" role="status" data-testid="pending-changes">
            {t("run.pending", { what: otherPending.map((k) => {
              // Catalogue keys can't contain dots ("inputs.ruleSet" → "inputs_ruleSet").
              const key = `run.pendingItems.${k.replaceAll(".", "_")}`;
              return t.has(key) ? t(key) : k;
            }).join(", ") })}
          </p>
        )}
        <ReviewStrip boq={boq} base={base} compact />
        <NewModelVersions boq={boq} base={base} />
        {error ? (
          <p role="alert" className="text-error">
            {message(error)}
          </p>
        ) : null}
      </div>
      {(dialog === "save" || dialog === "saveApproved" || dialog === "confirm") && (
        <SaveVersionDialog boq={boq} mode={dialog} open onOpenChange={(v) => !v && setDialog(null)} base={base} approval={approval} />
      )}
      {dialog === "submit" && <SubmitDialog boq={boq} open onOpenChange={(v) => !v && setDialog(null)} base={base} />}
      {dialog === "reopen" && <ReopenBoqDialog boq={boq} open onOpenChange={(v) => !v && setDialog(null)} />}
      {dialog === "share" && <ShareDialog boq={boq} open onOpenChange={(v) => !v && setDialog(null)} />}
    </div>
  );
}

function CurrentRunSummary({ run, base, relative }: { run: Run; base: string; relative: (iso: string) => string }) {
  const t = useTranslations("boqs.run");
  const stats = run.stats;
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1" data-testid="current-run" data-status={run.status} data-run={run.id}>
      <span className="tabular-nums">
        {t("summary", { lines: stats?.lines ?? 0, flagged: stats?.flaggedLines ?? 0, when: relative(run.finishedAt ?? run.createdAt) })}
      </span>
      {run.status === "needs_input" ? (
        <Link href={`${base}?tab=questions`} className="text-link hover:underline" data-testid="needs-input">
          {t("needsInput", { count: stats?.blockingQuestions ?? 0 })}
        </Link>
      ) : (
        <span className="label-caps" data-testid="run-complete">
          <Check aria-hidden className="mr-1 inline size-3" />
          {t("status.complete")}
        </span>
      )}
    </div>
  );
}
