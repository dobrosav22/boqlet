"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "next-intl";
import { useBoqs, useRun, type Boq, type Run } from "@/api/hooks/boqs";
import { useDiff, useDiffElements, useDiffLines, useRevisions, type ElementChange, type LineChange } from "@/api/hooks/diffs";
import { useExportDiff } from "@/api/hooks/exports";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { displayUnit } from "@/features/boq-sheet/model";
import { ModelViewer } from "@/features/viewer/model-viewer";
import { viewerModels } from "@/features/viewer/viewer-tab";
import { useRelativeTime } from "@/i18n/use-relative-time";
import { cn } from "@/lib/utils";
import { candidates, DEFAULT_THRESHOLD, groupLines, groupsIn, passes, type ChangeFilters } from "./model";

const CHANGE_CLASS: Record<string, string> = {
  added: "border-[var(--blue)] text-[var(--blue)]",
  changed: "border-[var(--orange)] text-[var(--orange)]",
  removed: "border-[var(--red)] text-[var(--red)]",
};

/**
 * S12d, the Changes tab (F08 §3–7): the current run (or `?to=`) against the last saved version's run
 * (or `?from=`, or one picked: an earlier run, a saved version, another BoQ). Summary, lines grouped
 * like the sheet with filters, elements, the viewer in the "changes" colour mode, and the export.
 */
export function ChangesTab({ boq, runs, base }: { boq: Boq; runs: Run[] | undefined; base: string }) {
  const t = useTranslations("boqs.changes");
  const relative = useRelativeTime();
  const message = useErrorMessage();
  const search = useSearchParams();
  const revisions = useRevisions(boq.id);
  const boqs = useBoqs(boq.projectId);
  const current = boq.currentRevision.currentRun;
  const toRunId = search.get("to") ?? current?.id;

  const { list, defaultRunId } = useMemo(
    () =>
      candidates({
        currentRunId: toRunId ?? "",
        revisions: (revisions.data ?? []).map((r) => ({ id: r.id, label: r.label, status: r.status, currentRun: r.currentRun ?? null })),
        runs: runs ?? [],
        otherBoqs: (boqs.data ?? []).filter((b) => b.id !== boq.id && !b.archived).map((b) => ({ name: b.name, currentRun: b.currentRevision.currentRun ?? null })),
        basedOnRevisionId: boq.currentRevision.basedOnRevisionId,
      }),
    [toRunId, revisions.data, runs, boqs.data, boq.id, boq.currentRevision.basedOnRevisionId],
  );
  const fromRunId = search.get("from") ?? defaultRunId ?? undefined;
  const choose = (from: string) => {
    const q = new URLSearchParams({ tab: "changes", from });
    if (search.get("to")) q.set("to", search.get("to")!);
    // Native history: the App Router keeps useSearchParams in step without asking the server again.
    window.history.replaceState(null, "", `${base}?${q.toString()}`);
  };

  if (!toRunId) return <p className="text-muted-foreground">{t("noRun")}</p>;
  const label = (c: (typeof list)[number]) => (c.kind === "saved" ? t("pick.saved", { label: c.label }) : c.kind === "boq" ? t("pick.boq", { name: c.label, when: relative(c.at) }) : t("pick.earlier", { when: relative(c.at) }));

  return (
    <div className="flex flex-col gap-6" data-testid="changes-tab">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("compareWith")}</span>
          <NativeSelect value={fromRunId ?? ""} onChange={(e) => e.target.value && choose(e.target.value)} data-testid="changes-from">
            {!fromRunId && <option value="">{t("pick.choose")}</option>}
            {fromRunId && !list.some((c) => c.runId === fromRunId) && <option value={fromRunId}>{t("pick.other")}</option>}
            {list.map((c) => (
              <option key={c.runId} value={c.runId}>
                {label(c)}
              </option>
            ))}
          </NativeSelect>
        </label>
        {search.get("to") && search.get("to") !== current?.id && <p className="text-muted-foreground">{t("olderRun")}</p>}
      </div>
      {!fromRunId ? (
        <p className="text-muted-foreground" data-testid="changes-none">
          {list.length ? t("chooseFirst") : t("nothingToCompare")}
        </p>
      ) : (
        <Report key={`${toRunId}|${fromRunId}`} boq={boq} toRunId={toRunId} fromRunId={fromRunId} runs={runs} message={message} base={base} />
      )}
    </div>
  );
}

function Report({ boq, toRunId, fromRunId, runs, message, base }: { boq: Boq; toRunId: string; fromRunId: string; runs: Run[] | undefined; message: (e: unknown) => string; base: string }) {
  const t = useTranslations("boqs.changes");
  const format = useFormatter();
  const router = useRouter();
  const diff = useDiff(toRunId, fromRunId);
  const lines = useDiffLines(diff.data?.id);
  const elements = useDiffElements(diff.data?.id);
  const exporting = useExportDiff(diff.data?.id);
  const toRun = runs?.find((r) => r.id === toRunId) ?? (boq.currentRevision.currentRun?.id === toRunId ? boq.currentRevision.currentRun : undefined);
  const systems = toRun?.classifications ?? [];
  const [system, setSystem] = useState<string | null>(systems[0]?.id ?? null);
  const [filters, setFilters] = useState<ChangeFilters>({ minDeltaPct: DEFAULT_THRESHOLD });
  const [focus, setFocus] = useState<string[] | null>(null);

  const all = useMemo(() => lines.data ?? [], [lines.data]);
  const shown = useMemo(() => all.filter((l) => passes(l, filters, system)), [all, filters, system]);
  const grouped = useMemo(() => groupLines(shown, system), [shown, system]);
  const groups = useMemo(() => groupsIn(all, system), [all, system]);
  const byChange = useMemo(() => {
    const out = { added: [] as string[], changed: [] as string[], removed: [] as string[] };
    for (const e of elements.data ?? []) out[e.change].push(e.guid);
    return out;
  }, [elements.data]);

  if (diff.isError) return <p role="alert" className="text-error">{message(diff.error)}</p>;
  if (!diff.data) return <p className="text-muted-foreground" aria-busy="true" data-testid="changes-loading">{t("comparing")}</p>;
  const s = diff.data.summary;
  const n = (v: number | undefined) => format.number(v ?? 0);
  const qty = (v: number | null | undefined) => (v === null || v === undefined ? "—" : format.number(v, { maximumFractionDigits: 3 }));
  const exportExcel = () => {
    const id = toast.loading(t("exporting"));
    exporting.mutate(undefined, { onSuccess: (e) => toast.success(t("exported", { file: e.fileName }), { id }), onError: (err) => toast.error(message(err), { id }) });
  };

  return (
    <div className="flex flex-col gap-8" data-testid="changes-report" data-diff={diff.data.id}>
      <section className="flex flex-col gap-3" data-testid="changes-summary">
        <div className="flex items-center gap-3">
          <h3 className="label-caps flex-1">{t("summary.title")}</h3>
          <Button variant="outline" onClick={exportExcel} disabled={exporting.isPending} data-testid="changes-export">
            <Download aria-hidden />
            {t("export")}
          </Button>
        </div>
        {s.guidChurnWarning && (
          <p role="alert" className="border-l-2 border-[var(--status-attention)] pl-3" data-testid="changes-churn">
            {t("summary.churn")}
          </p>
        )}
        <dl className="grid max-w-4xl grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-6 gap-y-3">
          {(
            [
              ["linesAdded", s.linesAdded],
              ["linesRemoved", s.linesRemoved],
              ["linesChanged", s.linesChanged],
              ["linesUnchanged", s.linesUnchanged],
              ["elementsAdded", s.elementsAdded],
              ["elementsRemoved", s.elementsRemoved],
              ["elementsChanged", s.elementsChanged],
              ["questionsNew", s.questionsNew],
              ["questionsResolved", s.questionsResolved],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="flex flex-col" data-testid={`summary-${key}`} data-value={value ?? 0}>
              <dt className="label-caps text-muted-foreground">{t(`summary.${key}`)}</dt>
              <dd className="text-title tabular-nums">{n(value)}</dd>
            </div>
          ))}
        </dl>
        <p data-testid="changes-inputs">
          {s.inputsChanged?.length
            ? t("summary.inputs", { what: s.inputsChanged.map((k) => (t.has(`inputs.${k.replaceAll(".", "_")}`) ? t(`inputs.${k.replaceAll(".", "_")}`) : k)).join(", ") })
            : t("summary.sameInputs")}
        </p>
        {(s.byModel ?? []).map((m) => (
          <p key={m.model} className="text-muted-foreground" data-testid="changes-by-model">
            {t("summary.byModel", { model: m.model, added: m.added, removed: m.removed, changed: m.changed })}
          </p>
        ))}
      </section>

      <section className="flex flex-col gap-3" data-testid="changes-lines">
        <h3 className="label-caps">{t("lines.title")}</h3>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="label-caps text-muted-foreground">{t("lines.change")}</span>
            <NativeSelect value={filters.change ?? ""} onChange={(e) => setFilters((f) => ({ ...f, change: (e.target.value || undefined) as ChangeFilters["change"] }))} data-testid="changes-filter-change">
              <option value="">{t("lines.all")}</option>
              {(["added", "removed", "changed"] as const).map((c) => (
                <option key={c} value={c}>
                  {t(`change.${c}`)}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-caps text-muted-foreground">{t("lines.threshold")}</span>
            <Input
              type="number"
              min={0}
              step={0.5}
              className="w-24"
              value={filters.minDeltaPct}
              onChange={(e) => setFilters((f) => ({ ...f, minDeltaPct: Math.max(0, Number(e.target.value) || 0) }))}
              data-testid="changes-filter-threshold"
            />
          </label>
          {systems.length > 1 && (
            <label className="flex flex-col gap-1">
              <span className="label-caps text-muted-foreground">{t("lines.groupBy")}</span>
              <NativeSelect value={system ?? ""} onChange={(e) => setSystem(e.target.value || null)}>
                {systems.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
          {groups.length > 1 && (
            <label className="flex flex-col gap-1">
              <span className="label-caps text-muted-foreground">{t("lines.group")}</span>
              <NativeSelect value={filters.group ?? "*"} onChange={(e) => setFilters((f) => ({ ...f, group: e.target.value === "*" ? undefined : e.target.value }))} data-testid="changes-filter-group">
                <option value="*">{t("lines.allGroups")}</option>
                {groups.map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.code ? `${g.code} ${g.title}` : t("lines.noGroup")}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
        </div>
        <p className="text-muted-foreground" data-testid="changes-legend">
          {t("lines.legend")}
        </p>
        {lines.isError && <p role="alert" className="text-error">{message(lines.error)}</p>}
        {lines.data && shown.length === 0 && <p className="text-muted-foreground" data-testid="changes-no-lines">{all.length ? t("lines.noneFiltered") : t("lines.none")}</p>}
        {shown.length > 0 && (
          <Table data-testid="changes-lines-table">
            <TableHeader>
              <TableRow>
                <TableHead className="label-caps">{t("lines.description")}</TableHead>
                <TableHead className="label-caps">{t("lines.change")}</TableHead>
                <TableHead className="label-caps text-right">{t("lines.before")}</TableHead>
                <TableHead className="label-caps text-right">{t("lines.after")}</TableHead>
                <TableHead className="label-caps text-right">{t("lines.delta")}</TableHead>
                <TableHead className="label-caps text-right">{t("lines.deltaPct")}</TableHead>
                <TableHead className="label-caps">{t("lines.unit")}</TableHead>
                <TableHead className="label-caps">{t("lines.causes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.map((g) => [
                system && (
                  <TableRow key={`group:${g.code}`} className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={8} className="label-caps">
                      {g.code ? `${g.code} ${g.title}` : t("lines.noGroup")}
                    </TableCell>
                  </TableRow>
                ),
                ...g.lines.map((l) => (
                  <LineRow key={l.lineKey} line={l} qty={qty} format={format} openInSheet={l.change !== "removed" ? () => router.push(`${base}?${new URLSearchParams({ tab: "sheet", line: l.lineKey }).toString()}`) : undefined} />
                )),
              ])}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="flex flex-col gap-3" data-testid="changes-elements">
        <h3 className="label-caps">{t("elements.title")}</h3>
        {elements.data && elements.data.length === 0 && <p className="text-muted-foreground" data-testid="changes-no-elements">{t("elements.none")}</p>}
        {elements.data && elements.data.length > 0 && <ElementsTable elements={elements.data} onShow={(g) => setFocus([g])} />}
      </section>

      {toRun && (
        <section className="flex flex-col gap-3">
          <h3 className="label-caps">{t("viewer")}</h3>
          <ChangesViewer toRun={toRun} fromRunId={fromRunId} byChange={byChange} focus={focus} />
        </section>
      )}
    </div>
  );
}

function LineRow({ line: l, qty, format, openInSheet }: { line: LineChange; qty: (v: number | null | undefined) => string; format: ReturnType<typeof useFormatter>; openInSheet?: () => void }) {
  const t = useTranslations("boqs.changes");
  const side = (l.after ?? l.before)!;
  const renamed = l.before && l.after && l.before.description !== l.after.description;
  return (
    <TableRow data-testid="change-line" data-key={l.lineKey} data-change={l.change}>
      <TableCell className="max-w-[420px]">
        {openInSheet ? (
          <button type="button" className="text-left hover:underline" onClick={openInSheet} title={l.lineKey}>
            {side.description}
          </button>
        ) : (
          <span title={l.lineKey}>{side.description}</span>
        )}
        {renamed && <p className="text-muted-foreground">{t("lines.was", { text: l.before!.description! })}</p>}
      </TableCell>
      <TableCell>
        <span className={cn("label-caps rounded-[var(--radius)] border px-1", CHANGE_CLASS[l.change])}>{t(`change.${l.change}`)}</span>
      </TableCell>
      <TableCell className="text-right tabular-nums">{qty(l.before?.quantity)}</TableCell>
      <TableCell className="text-right tabular-nums">{qty(l.after?.quantity)}</TableCell>
      <TableCell className="text-right tabular-nums">{l.delta === null || l.delta === undefined ? "—" : `${l.delta > 0 ? "+" : ""}${qty(l.delta)}`}</TableCell>
      <TableCell className="text-right tabular-nums">{l.deltaPct === null || l.deltaPct === undefined ? "—" : `${l.deltaPct > 0 ? "+" : ""}${format.number(l.deltaPct, { maximumFractionDigits: 1 })} %`}</TableCell>
      <TableCell>{side.unit ? displayUnit(side.unit) : ""}</TableCell>
      <TableCell className="text-muted-foreground" data-testid="change-causes">
        {(l.causes ?? []).map((c) => t(`causes.${c}`)).join(", ")}
      </TableCell>
    </TableRow>
  );
}

function ElementsTable({ elements, onShow }: { elements: ElementChange[]; onShow: (guid: string) => void }) {
  const t = useTranslations("boqs.changes");
  const [limit, setLimit] = useState(100);
  return (
    <>
      <Table data-testid="changes-elements-table">
        <TableHeader>
          <TableRow>
            <TableHead className="label-caps">{t("elements.guid")}</TableHead>
            <TableHead className="label-caps">{t("elements.model")}</TableHead>
            <TableHead className="label-caps">{t("lines.change")}</TableHead>
            <TableHead className="label-caps">{t("elements.fields")}</TableHead>
            <TableHead className="label-caps">{t("elements.lines")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {elements.slice(0, limit).map((e) => (
            <TableRow key={`${e.model}:${e.guid}`} data-testid="change-element" data-change={e.change}>
              <TableCell className="tabular-nums">
                {e.change === "removed" ? (
                  e.guid
                ) : (
                  <button type="button" className="text-link hover:underline" onClick={() => onShow(e.guid)}>
                    {e.guid}
                  </button>
                )}
              </TableCell>
              <TableCell>{e.model}</TableCell>
              <TableCell>
                <span className={cn("label-caps rounded-[var(--radius)] border px-1", CHANGE_CLASS[e.change])}>{t(`change.${e.change}`)}</span>
              </TableCell>
              <TableCell>{(e.fields ?? []).map((f) => (t.has(`fields.${f}`) ? t(`fields.${f}`) : f)).join(", ")}</TableCell>
              <TableCell className="text-muted-foreground" title={(e.lineKeys ?? []).join("\n")}>
                {t("elements.lineCount", { count: e.lineKeys?.length ?? 0 })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {elements.length > limit && (
        <Button variant="outline" className="self-start" onClick={() => setLimit((n) => n + 500)}>
          {t("elements.more", { count: elements.length - limit })}
        </Button>
      )}
    </>
  );
}

/** The newer run's models in the "changes" colour mode; removed elements from the older run's other versions as ghosts. */
function ChangesViewer({ toRun, fromRunId, byChange, focus }: { toRun: Run; fromRunId: string; byChange: { added: string[]; changed: string[]; removed: string[] }; focus: string[] | null }) {
  const fromRun = useRun(fromRunId).data;
  const models = useMemo(() => viewerModels(toRun), [toRun]);
  const ghostModels = useMemo(() => viewerModels(fromRun).filter((m) => !models.some((x) => x.versionId === m.versionId)), [fromRun, models]);
  const changes = useMemo(() => ({ ...byChange, ghostModels }), [byChange, ghostModels]);
  if (byChange.removed.length && !fromRun) return <div className="h-40" aria-busy="true" />;
  return <ModelViewer key={`${toRun.id}|${fromRunId}|${ghostModels.length}`} models={models} runId={toRun.id} systems={toRun.classifications ?? []} changes={changes} focusGuids={focus} className="h-[560px]" />;
}
