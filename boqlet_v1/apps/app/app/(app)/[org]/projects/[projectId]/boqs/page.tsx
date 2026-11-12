"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useBoqs } from "@/api/hooks/boqs";
import { useModels } from "@/api/hooks/models";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tag } from "@/features/boqs/boq-header";
import { CreateBoqDialog } from "@/features/boqs/create-boq-dialog";
import { useOrg } from "@/features/orgs/org-context";
import { useProjectScope } from "@/features/projects/project-context";
import { useRelativeTime } from "@/i18n/use-relative-time";

/** S11: the project's BoQs with their working version and current run (F04). Archived ones on request. */
export default function BoqsPage() {
  const t = useTranslations("boqs");
  const message = useErrorMessage();
  const relative = useRelativeTime();
  const { org } = useOrg();
  const { project, can } = useProjectScope();
  const boqs = useBoqs(project.id);
  const models = useModels(project.id);
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const base = `/${org.slug}/projects/${project.id}/boqs`;
  const all = boqs.data ?? [];
  const shown = all.filter((b) => showArchived || !b.archived);
  const hasReadyModel = (models.data ?? []).some((m) => m.latestVersion?.status === "ready");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <h2 className="text-title flex-1">{t("list.title")}</h2>
        {all.some((b) => b.archived) && (
          <label className="flex items-center gap-2 text-muted-foreground">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} data-testid="show-archived" />
            {t("list.showArchived")}
          </label>
        )}
        {can("editBoqs") && (
          <Button onClick={() => setCreating(true)} data-testid="new-boq">
            {t("list.new")}
          </Button>
        )}
      </div>
      {boqs.isError && (
        <p role="alert" className="text-error">
          {message(boqs.error)}
        </p>
      )}
      {boqs.isPending && <div className="h-32" aria-busy="true" />}
      {boqs.data && shown.length === 0 && <p className="text-muted-foreground">{hasReadyModel || all.length ? t("list.empty") : t("list.emptyNoModels")}</p>}
      {shown.length > 0 && (
        <Table data-testid="boqs-table">
          <TableHeader>
            <TableRow>
              <TableHead className="label-caps">{t("list.name")}</TableHead>
              <TableHead className="label-caps">{t("list.version")}</TableHead>
              <TableHead className="label-caps">{t("list.state")}</TableHead>
              <TableHead className="label-caps text-right">{t("list.lines")}</TableHead>
              <TableHead className="label-caps">{t("list.updated")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((b) => {
              const run = b.currentRevision.currentRun;
              return (
                <TableRow key={b.id} data-testid={`boq-row-${b.name}`}>
                  <TableCell>
                    <Link href={`${base}/${b.id}`} className="hover:underline">
                      {b.name}
                    </Link>
                    {b.archived && <Tag className="ml-2 border-muted-foreground text-muted-foreground">{t("list.archived")}</Tag>}
                  </TableCell>
                  <TableCell>
                    {b.currentRevision.label} · {t(`status.${b.status === "confirmed" ? "confirmed" : b.currentRevision.status}`)}
                  </TableCell>
                  <TableCell>
                    {run ? (
                      run.status === "needs_input" ? (
                        <span>{t("run.needsInput", { count: run.stats?.blockingQuestions ?? 0 })}</span>
                      ) : (
                        t(`run.status.${run.status}`)
                      )
                    ) : (
                      <span className="text-muted-foreground">{t("list.notGenerated")}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{run?.stats?.lines ?? "—"}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{b.updatedAt ? relative(b.updatedAt) : ""}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {can("editBoqs") && <CreateBoqDialog orgSlug={org.slug} orgId={org.id} project={project} open={creating} onOpenChange={setCreating} />}
    </div>
  );
}
