"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import type { Boq } from "@/api/hooks/boqs";
import { useLines } from "@/api/hooks/sheet";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { displayUnit } from "@/features/boq-sheet/model";
import { localJobs } from "@/realtime/local-jobs";

type Report = Schemas["EditsImportReport"];
type Proposal = Report["overrides"][number];

/** F06 §6: quantities and exclusions need a reason. */
const needsReason = (p: Proposal) => p.edit.quantity !== undefined || p.edit.excluded === true;

/** Uploads the edited workbook, waits for the `import_boq_edits` job, and fetches its report. */
async function readWorkbook(revisionId: string, file: File): Promise<Report> {
  const form = new FormData();
  form.append("file", file);
  const job = (await api.POST("/revisions/{revisionId}/edits-import", { params: { path: { revisionId } }, body: form as never, bodySerializer: (b) => b as unknown as FormData })).data!;
  localJobs.add(job.id);
  let current = job;
  const deadline = Date.now() + 120_000;
  while (current.status === "queued" || current.status === "running") {
    if (Date.now() > deadline) throw new Error("import timed out");
    await new Promise((r) => setTimeout(r, 400));
    current = (await api.GET("/jobs/{jobId}", { params: { path: { jobId: job.id } } })).data!;
  }
  return (await api.GET("/jobs/{jobId}/edits-import-report", { params: { path: { jobId: job.id } } })).data!;
}

/**
 * F12 "Editing in Excel and importing back" (P20): upload the edited BoQ workbook; the review list shows
 * every change it found (quantity, text, unit, a move to another section, a deleted row as an exclusion,
 * a new row as a manual line) and what it couldn't read. The person ticks what to apply and gives a
 * reason where F06 §6 asks; the ticked ones become line edits and manual lines in one go.
 */
export function EditsImport({ boq }: { boq: Boq }) {
  const t = useTranslations("boqs.exports.import");
  const te = useTranslations("boqs.exports");
  const format = useFormatter();
  const message = useErrorMessage();
  const client = useQueryClient();
  const revision = boq.currentRevision;
  const lines = useLines(revision.currentRun?.id);
  const byKey = useMemo(() => new Map((lines.data ?? []).map((l) => [l.key, l])), [lines.data]);
  const [report, setReport] = useState<Report | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<number | null>(null);

  const read = useMutation({
    mutationFn: (file: File) => readWorkbook(revision.id, file),
    meta: { ownConflicts: true },
    onSuccess: (r) => {
      setReport(r);
      setApplied(null);
      setReasons({});
      setTicked(new Set([...r.overrides.map((o) => `o:${o.edit.lineKey}`), ...r.manualItems.map((_, i) => `m:${i}`)]));
    },
    onError: () => {},
  });
  const apply = useMutation({
    mutationFn: async () => {
      const overrides = report!.overrides
        .filter((o) => ticked.has(`o:${o.edit.lineKey}`))
        .map((o) => ({ ...o.edit, ...(needsReason(o) ? { reason: reasons[o.edit.lineKey]!.trim() } : {}) }));
      const manualItems = report!.manualItems.filter((_, i) => ticked.has(`m:${i}`)).map((m) => m.item!);
      await api.POST("/boqs/{boqId}/overrides/batch", { params: { path: { boqId: boq.id } }, body: { overrides, manualItems } });
      return overrides.length + manualItems.length;
    },
    meta: { ownConflicts: true },
    onSuccess: async (n) => {
      setApplied(n);
      setReport(null);
      await Promise.all([client.invalidateQueries({ queryKey: keys.overrides(boq.id) }), client.invalidateQueries({ queryKey: keys.manualItems(boq.id) }), client.invalidateQueries({ queryKey: keys.boq(boq.id) })]);
    },
    onError: () => {},
  });

  const missingReason = report?.overrides.some((o) => ticked.has(`o:${o.edit.lineKey}`) && needsReason(o) && !reasons[o.edit.lineKey]?.trim());
  const toggle = (id: string, on: boolean) =>
    setTicked((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const qty = (v: number | null | undefined) => (v === null || v === undefined ? "—" : format.number(v, { maximumFractionDigits: 3 }));
  const describe = (p: Proposal) => {
    const line = byKey.get(p.edit.lineKey);
    const parts: string[] = [];
    if (p.edit.excluded) parts.push(t("whatExcluded"));
    if (p.edit.quantity !== undefined) parts.push(t("whatQuantity", { from: qty(line?.quantity), to: qty(p.edit.quantity) }));
    if (p.edit.unit !== undefined) parts.push(t("whatUnit", { to: displayUnit(p.edit.unit) }));
    if (p.edit.description !== undefined) parts.push(t("whatDescription", { to: p.edit.description }));
    if (p.edit.codes) parts.push(t("whatMoved", { to: Object.values(p.edit.codes).join(", ") }));
    return parts.join(" · ");
  };
  const count = (report?.overrides.length ?? 0) + (report?.manualItems.length ?? 0);

  return (
    <section className="flex flex-col gap-3" data-testid="edits-import">
      <h3 className="label-caps">{t("title")}</h3>
      <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
      <label className="flex w-fit cursor-pointer items-center gap-2">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3">
          <Upload aria-hidden className="size-4" />
          {read.isPending ? t("reading") : t("upload")}
        </span>
        <input
          type="file"
          accept=".xlsx"
          className="sr-only"
          disabled={read.isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) read.mutate(file);
            e.target.value = "";
          }}
          data-testid="edits-import-file"
        />
      </label>
      {(read.error ?? apply.error) ? (
        <p role="alert" className="text-error">
          {message(read.error ?? apply.error)}
        </p>
      ) : null}
      {applied !== null && (
        <p role="status" className="border-l-2 border-[var(--blue)] pl-3" data-testid="edits-import-applied">
          {t("applied", { count: applied })}
        </p>
      )}
      {report && (
        <div className="flex flex-col gap-4" data-testid="edits-import-review">
          <p>{count === 0 && report.problems.length === 0 ? t("nothing") : t("found", { count })}</p>
          {report.overrides.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead className="label-caps">{t("line")}</TableHead>
                  <TableHead className="label-caps">{t("change")}</TableHead>
                  <TableHead className="label-caps">{t("reason")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.overrides.map((o) => {
                  const id = `o:${o.edit.lineKey}`;
                  return (
                    <TableRow key={id} data-testid="edits-import-edit" data-change={o.change}>
                      <TableCell>
                        <input type="checkbox" aria-label={t("apply")} checked={ticked.has(id)} onChange={(e) => toggle(id, e.target.checked)} />
                      </TableCell>
                      <TableCell className="max-w-[360px]">
                        {byKey.get(o.edit.lineKey)?.description ?? o.edit.lineKey}
                        {o.row ? <span className="block text-muted-foreground">{t("row", { row: o.row })}</span> : null}
                      </TableCell>
                      <TableCell>
                        <span className="label-caps mr-2">{t(`changes.${o.change}`)}</span>
                        {describe(o)}
                      </TableCell>
                      <TableCell>
                        {needsReason(o) && ticked.has(id) && (
                          <Input
                            value={reasons[o.edit.lineKey] ?? ""}
                            onChange={(e) => setReasons((r) => ({ ...r, [o.edit.lineKey]: e.target.value }))}
                            placeholder={t("reasonPlaceholder")}
                            aria-label={t("reason")}
                            data-testid="edits-import-reason"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {report.manualItems.length > 0 && (
            <div className="flex flex-col gap-1">
              <h4 className="label-caps text-muted-foreground">{t("newLines")}</h4>
              {report.manualItems.map((m, i) => (
                <label key={i} className="flex items-center gap-2" data-testid="edits-import-manual">
                  <input type="checkbox" checked={ticked.has(`m:${i}`)} onChange={(e) => toggle(`m:${i}`, e.target.checked)} />
                  <span>
                    {String(m.item?.item.description ?? "")} · {qty(typeof m.item?.item.quantity === "number" ? m.item.item.quantity : null)} {displayUnit(String(m.item?.item.unit ?? ""))}
                    {m.item?.codes ? <span className="text-muted-foreground"> · {Object.values(m.item.codes).join(", ")}</span> : null}
                    {m.row ? <span className="text-muted-foreground"> · {t("row", { row: m.row })}</span> : null}
                  </span>
                </label>
              ))}
            </div>
          )}
          {report.problems.length > 0 && (
            <div className="flex flex-col gap-1" data-testid="edits-import-problems">
              <h4 className="label-caps text-muted-foreground">{t("problems")}</h4>
              <ul className="flex flex-col gap-1">
                {report.problems.map((p, i) => (
                  <li key={i} className="border-l-2 border-[var(--status-attention)] pl-3">
                    {p.row ? `${t("cell", { sheet: p.sheet ?? "BoQ", row: p.row, column: p.column ?? "" })}: ` : ""}
                    {p.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={() => apply.mutate()} disabled={apply.isPending || ticked.size === 0 || missingReason} data-testid="edits-import-apply">
              {t("applyTicked", { count: ticked.size })}
            </Button>
            <Button variant="ghost" onClick={() => setReport(null)}>
              {te("cancel")}
            </Button>
          </div>
          {missingReason && <p className="text-muted-foreground">{t("reasonNeeded")}</p>}
        </div>
      )}
    </section>
  );
}
