"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCoreRowModel, useReactTable, type ColumnDef, type VisibilityState } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronRight, Columns3 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Run } from "@/api/hooks/boqs";
import { useLines, type RunLine } from "@/api/hooks/sheet";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { LineDetailPanel } from "./line-detail";
import { buildRows, displayUnit, facets, filterLines, type GroupRow, type Row, type SheetFilters, type Source } from "./model";
import { SourceTag } from "./source-tag";
import { WarningsBar } from "./warnings-bar";

/** Fixed row height (architecture.md performance budget: virtualised rows, fixed height). */
const ROW = 32;
const SOURCES: Source[] = ["measured", "derived", "manual", "flagged"];

interface ColumnMeta {
  id: string;
  width: string;
  align?: "right";
  /** Columns that can be switched off. */
  optional?: boolean;
  cell: (line: RunLine) => React.ReactNode;
}

interface GroupLabels {
  unclassified: string;
  lines: (count: number) => string;
  expand: (name: string) => string;
  collapse: (name: string) => string;
}

/**
 * The BoQ sheet (F06 §1–4, §10, §11): every line of the run, grouped by any attached
 * classification with subtotals, filters that never change the data, toggleable columns, the line
 * detail beside it. Line edits come with FE-011; until then the sheet is read-only for everyone.
 *
 * Performance (F06-AC11, 20,000 lines): rows are virtualised at a fixed height in `SheetGrid`, so a
 * scroll re-renders neither the toolbar nor the rows already on screen (`SheetRow` is memoised and
 * gets only stable props).
 */
export function Sheet({ run }: { run: Run }) {
  const t = useTranslations("boqs.sheet");
  const locale = useLocale();
  const message = useErrorMessage();
  const lines = useLines(run.id);
  const systems = useMemo(() => run.classifications ?? [], [run.classifications]);
  const systemNames = useMemo(() => new Map(systems.map((s) => [s.id, s.name])), [systems]);
  const modelNames = useMemo(() => new Map((run.models ?? []).map((m) => [m.id, m.fileName])), [run.models]);
  const [groupBy, setGroupBy] = useState<string | null>(systems[0]?.id ?? null);
  const [filters, setFilters] = useState<SheetFilters>({});
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<VisibilityState>({ family: false, tags: false, notes: false });
  const search = useRef<HTMLInputElement>(null);

  const all = useMemo(() => lines.data ?? [], [lines.data]);
  const options = useMemo(() => facets(all), [all]);
  const filtered = useMemo(() => filterLines(all, filters), [all, filters]);
  const rows = useMemo(() => buildRows(filtered, groupBy, collapsed), [filtered, groupBy, collapsed]);
  const filtering = filtered.length !== all.length;
  // One formatter for every cell (the rule set's rounding is already applied by the engine).
  const num = useMemo(() => {
    const f = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 });
    return (v: number) => f.format(v);
  }, [locale]);
  const toConfirm = t("toConfirm");

  const columns = useMemo<ColumnDef<RunLine>[]>(() => {
    const col = (id: string, header: string, meta: Omit<ColumnMeta, "id">): ColumnDef<RunLine> => ({ id, header, meta: { id, ...meta }, enableHiding: !!meta.optional });
    return [
      col("item", t("col.item"), { width: "8rem", cell: (l) => (groupBy ? l.codes[groupBy]?.code : null) }),
      col("description", t("col.description"), { width: "minmax(16rem, 1fr)", cell: (l) => l.description }),
      col("unit", t("col.unit"), { width: "4.5rem", cell: (l) => displayUnit(l.unit) }),
      col("quantity", t("col.quantity"), {
        width: "8rem",
        align: "right",
        cell: (l) => (l.quantity === null ? <span title={l.notes[0] ?? toConfirm}>—</span> : num(l.quantity)),
      }),
      col("source", t("col.source"), { width: "7.5rem", cell: (l) => <SourceTag source={l.source} /> }),
      col("storey", t("col.storey"), { width: "8rem", optional: true, cell: (l) => l.location?.storey ?? l.location?.storeys?.join(", ") }),
      col("family", t("col.family"), { width: "7rem", optional: true, cell: (l) => l.family }),
      col("tags", t("col.tags"), { width: "8rem", optional: true, cell: (l) => l.tags.join(", ") }),
      col("notes", t("col.notes"), { width: "12rem", optional: true, cell: (l) => l.notes.join(" ") }),
      // One column per extra classification (F06 §2), off by default.
      ...systems.filter((s) => s.id !== groupBy).map((s) => col(`code:${s.id}`, s.name, { width: "8rem", optional: true, cell: (l) => l.codes[s.id]?.code })),
    ];
  }, [groupBy, systems, num, t, toConfirm]);

  // TanStack Table owns the columns and their visibility; the rows are the sheet's own (groups + lines).
  // It returns functions the React Compiler can't memoise, so this component is left uncompiled.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: [] as RunLine[],
    columns,
    state: { columnVisibility: { ...Object.fromEntries(systems.map((s) => [`code:${s.id}`, false])), ...visibility } },
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
  });
  const visibleIds = table
    .getVisibleLeafColumns()
    .map((c) => c.id)
    .join("|");
  // Stable while the visible columns don't change, so the memoised rows don't re-render.
  const visibleMetas = useMemo(
    () => visibleIds.split("|").map((id) => columns.find((c) => c.id === id)!.meta as ColumnMeta),
    [visibleIds, columns],
  );
  const headers = useMemo(() => new Map(columns.map((c) => [c.id!, String(c.header)])), [columns]);

  const groupLabels = useMemo<GroupLabels>(
    () => ({
      unclassified: t("unclassified"),
      lines: (count) => t("groupLines", { count }),
      expand: (name) => t("expand", { name }),
      collapse: (name) => t("collapse", { name }),
    }),
    [t],
  );

  // "/" focuses the search (F06 §10), unless typing somewhere already.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== "/" || target?.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      search.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = useCallback(
    (id: string) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const setFilter = <K extends keyof SheetFilters>(key: K, value: SheetFilters[K] | "") => setFilters((f) => ({ ...f, [key]: value || undefined }));

  if (lines.isError) return <p role="alert" className="text-error">{message(lines.error)}</p>;
  if (!lines.data) return <p className="text-muted-foreground" aria-busy="true">{t("loading")}</p>;

  return (
    <div className="flex flex-col gap-3" data-testid="sheet">
      <WarningsBar runId={run.id} />
      <div className="flex flex-wrap items-end gap-3" data-testid="sheet-toolbar">
        <label className="flex flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("groupBy")}</span>
          <NativeSelect value={groupBy ?? ""} onChange={(e) => setGroupBy(e.target.value || null)} data-testid="group-by">
            {systems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="">{t("noGrouping")}</option>
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("source")}</span>
          <NativeSelect value={filters.source ?? ""} onChange={(e) => setFilter("source", e.target.value as Source)} data-testid="filter-source">
            <option value="">{t("all")}</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {t(`sources.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
        {options.storeys.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="label-caps text-muted-foreground">{t("storey")}</span>
            <NativeSelect value={filters.storey ?? ""} onChange={(e) => setFilter("storey", e.target.value)} data-testid="filter-storey">
              <option value="">{t("all")}</option>
              {options.storeys.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        {options.families.length > 1 && (
          <label className="flex flex-col gap-1">
            <span className="label-caps text-muted-foreground">{t("family")}</span>
            <NativeSelect value={filters.family ?? ""} onChange={(e) => setFilter("family", e.target.value)} data-testid="filter-family">
              <option value="">{t("all")}</option>
              {options.families.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        {options.models.length > 1 && (
          <label className="flex flex-col gap-1">
            <span className="label-caps text-muted-foreground">{t("model")}</span>
            <NativeSelect value={filters.model ?? ""} onChange={(e) => setFilter("model", e.target.value)} data-testid="filter-model">
              <option value="">{t("all")}</option>
              {options.models.map((m) => (
                <option key={m} value={m}>
                  {modelNames.get(m) ?? m.slice(0, 8)}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        <label className="flex min-w-56 flex-1 flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("search")}</span>
          <Input ref={search} type="search" value={filters.q ?? ""} placeholder={t("searchHint")} onChange={(e) => setFilter("q", e.target.value)} data-testid="sheet-search" />
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" data-testid="columns-menu" />}>
            <Columns3 aria-hidden />
            {t("columns")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllLeafColumns()
              .filter((c) => c.getCanHide())
              .map((c) => (
                <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)} data-testid={`column-${c.id}`}>
                  {String(c.columnDef.header)}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {filtering && (
        <p className="flex items-center gap-3" role="status" data-testid="filtered-count">
          {t("filtered", { shown: filtered.length, total: all.length })}
          <button className="text-link hover:underline" onClick={() => setFilters({})}>
            {t("clearFilters")}
          </button>
        </p>
      )}

      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="min-w-0 flex-1">
          <SheetGrid
            rows={rows}
            columns={visibleMetas}
            headers={headers}
            selected={selected}
            onSelect={setSelected}
            onToggle={toggle}
            num={num}
            labels={groupLabels}
            emptyText={t("noMatches")}
            label={t("tableLabel")}
          />
        </div>
        {selected && <LineDetailPanel run={run} lineKey={selected} modelNames={modelNames} systemNames={systemNames} onSelect={setSelected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}

/** The virtualised body: header, rows, keyboard (arrows move the selection, Escape clears it). */
function SheetGrid({
  rows,
  columns,
  headers,
  selected,
  onSelect,
  onToggle,
  num,
  labels,
  emptyText,
  label,
}: {
  rows: Row[];
  columns: ColumnMeta[];
  headers: Map<string, string>;
  selected: string | null;
  onSelect: React.Dispatch<React.SetStateAction<string | null>>;
  onToggle: (id: string) => void;
  num: (v: number) => string;
  labels: GroupLabels;
  emptyText: string;
  label: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  // Like TanStack Table, the virtualizer returns functions the React Compiler can't memoise.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => scroller.current, estimateSize: () => ROW, overscan: 12 });
  const lineIndexes = useMemo(() => rows.flatMap((r, i) => (r.kind === "line" ? [i] : [])), [rows]);
  const template = useMemo(() => columns.map((c) => c.width).join(" "), [columns]);
  const unitIndex = columns.findIndex((c) => c.id === "unit");
  const quantityIndex = columns.findIndex((c) => c.id === "quantity");
  // Clicking a selected line closes its detail; the handler stays stable across renders.
  const clickLine = useCallback((key: string) => onSelect((current) => (current === key ? null : key)), [onSelect]);

  const move = (by: number) => {
    if (!lineIndexes.length) return;
    const at = selected ? lineIndexes.findIndex((i) => rows[i]!.id === selected) : -1;
    const next = lineIndexes[Math.max(0, Math.min(lineIndexes.length - 1, at < 0 ? 0 : at + by))]!;
    onSelect(rows[next]!.id);
    virtualizer.scrollToIndex(next, { align: "auto" });
  };

  return (
    <div
      ref={scroller}
      role="grid"
      aria-label={label}
      aria-rowcount={rows.length + 1}
      tabIndex={0}
      className="relative h-[max(24rem,calc(100dvh-24rem))] overflow-auto border-y border-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          move(e.key === "ArrowDown" ? 1 : -1);
        } else if (e.key === "Escape") onSelect(null);
        else if (e.key === "Enter" && !selected) move(0);
      }}
      data-testid="sheet-grid"
      data-rows={rows.length}
      data-lines={lineIndexes.length}
    >
      <div role="row" className="sticky top-0 z-10 grid min-w-fit border-b border-border bg-background" style={{ gridTemplateColumns: template, height: ROW }}>
        {columns.map((c) => (
          <div key={c.id} role="columnheader" className={cn("label-caps flex items-center truncate px-2 text-muted-foreground", c.align === "right" && "justify-end")}>
            {headers.get(c.id)}
          </div>
        ))}
      </div>
      {rows.length === 0 && <p className="p-4 text-muted-foreground">{emptyText}</p>}
      <div className="relative min-w-fit" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((v) => {
          const row = rows[v.index]!;
          return row.kind === "group" ? (
            <GroupRowView key={`g:${row.id}`} row={row} top={v.start} index={v.index} template={template} unitIndex={unitIndex} quantityIndex={quantityIndex} columnCount={columns.length} onToggle={onToggle} num={num} labels={labels} />
          ) : (
            <LineRowView key={`l:${row.id}`} line={row.line} depth={row.depth} top={v.start} index={v.index} template={template} columns={columns} selected={row.id === selected} onClick={clickLine} />
          );
        })}
      </div>
    </div>
  );
}

const GroupRowView = memo(function GroupRowView({
  row,
  top,
  index,
  template,
  unitIndex,
  quantityIndex,
  columnCount,
  onToggle,
  num,
  labels,
}: {
  row: GroupRow;
  top: number;
  index: number;
  template: string;
  unitIndex: number;
  quantityIndex: number;
  columnCount: number;
  onToggle: (id: string) => void;
  num: (v: number) => string;
  labels: GroupLabels;
}) {
  const name = row.title === null ? labels.unclassified : `${row.code} ${row.title}`;
  // The group spans the columns before Unit; the subtotal sits under Unit and Quantity when the unit is shared.
  const span = Math.max(1, unitIndex >= 0 ? unitIndex : columnCount);
  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      aria-expanded={!row.collapsed}
      className="absolute top-0 left-0 grid w-full min-w-fit border-b border-border bg-muted/50 font-semibold"
      style={{ gridTemplateColumns: template, height: ROW, transform: `translateY(${top}px)` }}
      data-testid="sheet-group"
      data-group={row.id}
    >
      <button
        className="flex items-center gap-1 truncate text-left"
        style={{ paddingLeft: `${0.5 + row.depth}rem`, gridColumn: `span ${span}` }}
        onClick={() => onToggle(row.id)}
        aria-label={row.collapsed ? labels.expand(name) : labels.collapse(name)}
      >
        {row.collapsed ? <ChevronRight aria-hidden className="size-3.5 shrink-0" /> : <ChevronDown aria-hidden className="size-3.5 shrink-0" />}
        <span className="truncate">{name}</span>
        <span className="ml-2 font-normal text-muted-foreground">{labels.lines(row.lineCount)}</span>
      </button>
      {unitIndex >= 0 && <div className="flex items-center px-2 font-normal">{row.unit ? displayUnit(row.unit) : null}</div>}
      {quantityIndex >= 0 && (
        <div className="flex items-center justify-end px-2 tabular-nums" data-testid="group-subtotal">
          {row.quantity !== null ? num(row.quantity) : null}
        </div>
      )}
    </div>
  );
});

const LineRowView = memo(function LineRowView({
  line,
  depth,
  top,
  index,
  template,
  columns,
  selected,
  onClick,
}: {
  line: RunLine;
  depth: number;
  top: number;
  index: number;
  template: string;
  columns: ColumnMeta[];
  selected: boolean;
  onClick: (key: string) => void;
}) {
  return (
    <div
      role="row"
      aria-rowindex={index + 2}
      aria-selected={selected}
      className={cn(
        "absolute top-0 left-0 grid w-full min-w-fit cursor-pointer border-b border-border hover:bg-muted/40",
        selected && "bg-[var(--selection)] shadow-[inset_2px_0_0_var(--link)]",
      )}
      style={{ gridTemplateColumns: template, height: ROW, transform: `translateY(${top}px)` }}
      onClick={() => onClick(line.key)}
      data-testid="sheet-line"
      data-key={line.key}
      data-source={line.source}
    >
      {columns.map((c) => (
        <div
          key={c.id}
          role="gridcell"
          className={cn("flex items-center truncate px-2", c.align === "right" && "justify-end tabular-nums")}
          style={c.id === "description" ? { paddingLeft: `${0.5 + depth}rem` } : undefined}
        >
          <span className="truncate">{c.cell(line)}</span>
        </div>
      ))}
    </div>
  );
});
