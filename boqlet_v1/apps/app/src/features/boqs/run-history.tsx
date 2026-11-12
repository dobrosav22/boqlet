"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { Run } from "@/api/hooks/boqs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** S12h, basic (F04 §5): the runs of the working version, newest first. Saved versions come with F09. */
export function RunHistory({ runs, currentRunId }: { runs: Run[] | undefined; currentRunId?: string }) {
  const t = useTranslations("boqs");
  const format = useFormatter();
  if (!runs) return <div className="h-24" aria-busy="true" />;
  return (
    <section className="flex flex-col gap-3" data-testid="run-history">
      <h3 className="label-caps">{t("versions.runs")}</h3>
      {runs.length === 0 ? (
        <p className="text-muted-foreground">{t("versions.noRuns")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="label-caps">{t("versions.when")}</TableHead>
              <TableHead className="label-caps">{t("versions.by")}</TableHead>
              <TableHead className="label-caps">{t("versions.status")}</TableHead>
              <TableHead className="label-caps text-right">{t("versions.lines")}</TableHead>
              <TableHead className="label-caps text-right">{t("versions.flagged")}</TableHead>
              <TableHead className="label-caps text-right">{t("versions.duration")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((r) => (
              <TableRow key={r.id} data-testid="run-row" data-status={r.status}>
                <TableCell className="tabular-nums">
                  {format.dateTime(new Date(r.createdAt), { dateStyle: "medium", timeStyle: "medium" })}
                  {r.id === currentRunId && <span className="label-caps ml-2 rounded-[var(--radius)] border border-foreground px-1">{t("versions.current")}</span>}
                </TableCell>
                <TableCell>{r.createdBy?.name}</TableCell>
                <TableCell className={cn(r.status === "failed" && "text-error")}>{t(`run.status.${r.status}`)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.stats ? format.number(r.stats.lines ?? 0) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.stats ? format.number(r.stats.flaggedLines ?? 0) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.finishedAt ? t("sheet.seconds", { s: format.number((new Date(r.finishedAt).getTime() - new Date(r.createdAt).getTime()) / 1000, { maximumFractionDigits: 1 }) }) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
