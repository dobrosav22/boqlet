"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import type { Run } from "@/api/hooks/boqs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * S12h, basic (F04 §5): the runs of the working version, newest first. Saved versions come with F09.
 * Two finished runs can be ticked and compared (F08 §6): the Changes tab, older against newer.
 */
export function RunHistory({ runs, currentRunId, base, canCompare }: { runs: Run[] | undefined; currentRunId?: string; base: string; canCompare: boolean }) {
  const t = useTranslations("boqs");
  const format = useFormatter();
  const router = useRouter();
  const [ticked, setTicked] = useState<string[]>([]);
  const finished = (r: Run) => r.status === "complete" || r.status === "needs_input";
  const compare = () => {
    const [a, b] = ticked.map((id) => runs!.find((r) => r.id === id)!).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
    router.push(`${base}?${new URLSearchParams({ tab: "changes", from: a!.id, to: b!.id }).toString()}`);
  };
  if (!runs) return <div className="h-24" aria-busy="true" />;
  return (
    <section className="flex flex-col gap-3" data-testid="run-history">
      <div className="flex items-center gap-3">
        <h3 className="label-caps flex-1">{t("versions.runs")}</h3>
        {canCompare && (runs?.filter(finished).length ?? 0) > 1 && (
          <Button variant="outline" disabled={ticked.length !== 2} onClick={compare} title={t("versions.compareHint")} data-testid="compare-runs">
            {t("versions.compare")}
          </Button>
        )}
      </div>
      {runs.length === 0 ? (
        <p className="text-muted-foreground">{t("versions.noRuns")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {canCompare && <TableHead className="w-10" />}
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
                {canCompare && (
                  <TableCell>
                    {finished(r) && (
                      <input
                        type="checkbox"
                        aria-label={t("versions.pick")}
                        checked={ticked.includes(r.id)}
                        disabled={!ticked.includes(r.id) && ticked.length >= 2}
                        onChange={(e) => setTicked((s) => (e.target.checked ? [...s, r.id] : s.filter((x) => x !== r.id)))}
                        data-testid="run-pick"
                      />
                    )}
                  </TableCell>
                )}
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
