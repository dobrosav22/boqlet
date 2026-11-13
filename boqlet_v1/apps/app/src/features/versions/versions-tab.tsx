"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { api } from "@/api/client";
import type { Boq, Run } from "@/api/hooks/boqs";
import { useRevisions } from "@/api/hooks/diffs";
import { saveFile } from "@/api/hooks/exports";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RunHistory } from "@/features/boqs/run-history";

/**
 * S12h (F09 §3): the saved versions (label, note, who, when, lines, open questions; open read-only,
 * the Excel frozen with it, compare with the working version), then the runs of the working version.
 */
export function VersionsTab({ boq, runs, base, canCompare }: { boq: Boq; runs: Run[] | undefined; base: string; canCompare: boolean }) {
  const t = useTranslations("boqs.versions");
  const format = useFormatter();
  const message = useErrorMessage();
  const revisions = useRevisions(boq.id);
  const saved = (revisions.data ?? []).filter((r) => r.status === "issued");
  const current = boq.currentRevision.currentRun?.id;
  const download = useMutation({
    mutationFn: async (exportId: string) => {
      const meta = (await api.GET("/exports/{exportId}", { params: { path: { exportId } } })).data!;
      const blob = (await api.GET("/exports/{exportId}/download", { params: { path: { exportId } }, parseAs: "blob" })).data as unknown as Blob;
      saveFile(blob, meta.fileName);
    },
    onError: () => {},
  });

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3" data-testid="saved-versions">
        <h3 className="label-caps">{t("saved")}</h3>
        {revisions.data && saved.length === 0 && <p className="text-muted-foreground">{t("noSaved")}</p>}
        {saved.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="label-caps">{t("label")}</TableHead>
                <TableHead className="label-caps">{t("note")}</TableHead>
                <TableHead className="label-caps">{t("savedBy")}</TableHead>
                <TableHead className="label-caps">{t("savedAt")}</TableHead>
                <TableHead className="label-caps text-right">{t("linesCol")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {saved.map((r) => {
                const exportId = r.frozen?.exportIds?.[0];
                const open = r.openQuestionsAtSave ?? 0;
                return (
                  <TableRow key={r.id} data-testid="saved-version" data-label={r.label}>
                    <TableCell>
                      <span className="font-semibold">{r.label}</span>
                      {open > 0 && (
                        <span className="label-caps ml-2 rounded-[var(--radius)] border border-[var(--status-attention)] px-1" data-testid="saved-open-questions">
                          {t("openQuestions", { count: open })}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate" title={r.issueNote}>
                      {r.issueNote ?? ""}
                    </TableCell>
                    <TableCell>{r.issuedBy?.name}</TableCell>
                    <TableCell className="tabular-nums">{r.issuedAt ? format.dateTime(new Date(r.issuedAt), { dateStyle: "medium", timeStyle: "short" }) : ""}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.currentRun?.stats ? format.number(r.currentRun.stats.lines ?? 0) : "—"}</TableCell>
                    <TableCell className="flex flex-wrap justify-end gap-2">
                      <Link href={`${base}?${new URLSearchParams({ tab: "sheet", version: r.id }).toString()}`} className="text-link hover:underline" data-testid="open-version">
                        {t("open")}
                      </Link>
                      {exportId ? (
                        <Button variant="ghost" size="sm" onClick={() => download.mutate(exportId)} disabled={download.isPending} data-testid="version-excel">
                          <Download aria-hidden />
                          {t("download")}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">{t("noExcel")}</span>
                      )}
                      {canCompare && r.frozen?.runId && current && r.frozen.runId !== current && (
                        <Link href={`${base}?${new URLSearchParams({ tab: "changes", from: r.frozen.runId }).toString()}`} className="text-link hover:underline" data-testid="compare-version">
                          {t("compareWith")}
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {download.error ? (
          <p role="alert" className="text-error">
            {message(download.error)}
          </p>
        ) : null}
      </section>
      <RunHistory runs={runs} currentRunId={current} base={base} canCompare={canCompare} />
    </div>
  );
}
