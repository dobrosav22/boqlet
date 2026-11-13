"use client";

/**
 * Classification as a table (the PoC's `ClassTable.tsx`): one row per kind of BoQ line (the items
 * of a rule set, usually the master template), one code per row picked from the code list. A row
 * can be split by a fixed choice of line field (inside/outside, material, element type) with a code
 * per value. The table reads and writes ordinary map rules (`readTable` / `writeRow` in model.ts).
 */
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ClassificationMap, CodeList } from "@ifc-boq/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Select, Text, inputClass, linkButton } from "../shared/fields";
import { cap } from "../shared/story";
import { aimed, byPriority, covered, emptyRow, outcomeFor, readTable, SPLIT_KINDS, suggest, viaAdvanced, writeRow, type LineKind, type RowConfig, type SplitKind, type Target } from "./model";
import { OutcomeWords, useClassWords } from "./class-story";
import { LineSample } from "./item-text-box";
import type { PreviewLine } from "./item-text";
import { NavLink, useCodes } from "./nav";

export interface Term {
  id: string;
  label: string;
  category: string;
}

/* ================================================================ pickers */

/** A code typed or picked from the code list, with its title under it (in red when the list doesn't have it). */
export function CodePicker({ value, onChange, ...rest }: { value: string | undefined; onChange: (v: string | undefined) => void; "aria-label"?: string }) {
  const t = useTranslations("classificationEditor.table");
  const { titles, listId } = useCodes();
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <Text mono list={listId} value={value} onChange={onChange} placeholder={t("codePlaceholder")} {...rest} />
      {value && <span className={titles.has(value) ? "text-muted-foreground" : "text-error"}>{titles.get(value) ?? t("notInList")}</span>}
    </span>
  );
}

function TargetPicker({ value, onChange, derived, label, line }: {
  value: Target;
  onChange: (t: Target) => void;
  derived: boolean;
  label: string;
  /** The preview's first line of this BoQ item, for the code's item text as a sample. */
  line?: PreviewLine;
}) {
  const t = useTranslations("classificationEditor.table");
  const fromSource = !!value && typeof value === "object";
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {derived && (
        <Select
          value={fromSource ? "source" : "code"}
          options={["code", "source"] as const}
          labels={{ code: t("targetCode"), source: t("targetSource") }}
          onChange={(v) => onChange(v === "source" ? { fromSource: true } : null)}
          aria-label={label}
        />
      )}
      {!fromSource && <CodePicker value={typeof value === "string" ? value : undefined} onChange={(v) => onChange(v ?? null)} aria-label={label} />}
      {typeof value === "string" && <LineSample code={value} line={line} />}
    </div>
  );
}

/* ================================================================ the tab */

export interface RuleSetOption {
  id: string;
  name: string;
}

const GROUPS = ["item", "derived", "manual"] as const;

export function ClassTable({ codeList, map, onChange, ruleSets, rsId, setRsId, kinds: loaded, rsError, terms, onOpenRule, previewLines }: {
  codeList: CodeList;
  map: ClassificationMap;
  onChange: (m: ClassificationMap) => void;
  ruleSets: RuleSetOption[];
  rsId: string | undefined;
  setRsId: (id: string) => void;
  /** The BoQ items of the chosen rule set; null while loading. */
  kinds: LineKind[] | null;
  rsError: string | null;
  /** Dictionary terms, for splits by material or element type. */
  terms: Term[];
  /** Show a map rule in Advanced (by its index in map.rules). */
  onOpenRule: (index: number) => void;
  /** The latest preview's first line of each BoQ item (by id); null without a preview. */
  previewLines?: Map<string, PreviewLine> | null;
}) {
  const t = useTranslations("classificationEditor.table");
  const w = useClassWords();
  const { titles } = useCodes();
  const [suggested, setSuggested] = useState<Record<string, string>>({});
  /** Rows being edited: a split whose values have no code yet has no map rule to read back from. */
  const [pending, setPending] = useState<Record<string, RowConfig>>({});
  const rs = loaded;

  const { rows, used } = readTable(map);
  const advanced = map.rules.filter((_, i) => !used.has(i));
  /** Rules not aimed at any BoQ item: shown once above the table instead of under every row. */
  const anyLine = byPriority(map.rules).filter(({ rule, index }) => !used.has(index) && !aimed(rule.match));
  const kinds = loaded ?? [];
  const label = (id: string) => kinds.find((k) => k.id === id)?.label ?? id;
  const orphans = [...rows.keys()].filter((id) => !kinds.some((k) => k.id === id));
  const termOptions = (kind: SplitKind) => terms.filter((x) => (kind === "material" ? x.category === "material" || x.category === "product" : x.category === "element_type"));
  const termLabel = (id: string) => terms.find((x) => x.id === id)?.label ?? id;

  const cfgOf = (id: string): RowConfig => pending[id] ?? rows.get(id) ?? emptyRow();
  const setRow = (id: string, cfg: RowConfig) => {
    onChange(writeRow(map, id, cfg));
    setPending((p) => ({ ...p, [id]: cfg }));
    setSuggested((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== id)));
  };
  const coded = kinds.filter((k) => cfgOf(k.id).code || cfgOf(k.id).values.some((v) => v.code)).length;

  const runSuggest = () => {
    const out: Record<string, string> = {};
    for (const k of kinds) {
      const c = cfgOf(k.id);
      if (c.code || c.values.length || viaAdvanced(advanced, k.id).length) continue;
      const s = suggest(`${k.label} ${k.id.replace(/-/g, " ")}`, codeList.codes);
      if (s) out[k.id] = s;
    }
    setSuggested(out);
  };
  const acceptAll = () => {
    let m = map;
    for (const [id, code] of Object.entries(suggested)) m = writeRow(m, id, { ...cfgOf(id), code });
    onChange(m);
    setSuggested({});
  };
  const nSuggested = Object.keys(suggested).length;

  const row = (k: LineKind) => {
    const outcome = k.orphan ? null : outcomeFor(map, k);
    return (
      <Row
        key={k.id}
        kind={k}
        sub={w.kindSub(k)}
        cfg={cfgOf(k.id)}
        onChange={(c) => setRow(k.id, c)}
        termOptions={termOptions}
        termLabel={termLabel}
        via={k.orphan ? [] : viaAdvanced(advanced, k.id)}
        suggestion={suggested[k.id]}
        onAccept={() => setRow(k.id, { ...cfgOf(k.id), code: suggested[k.id]! })}
        outcome={outcome && <OutcomeWords outcome={outcome} titles={titles} kind={k} kinds={kinds} map={map} table={used} onOpenRule={onOpenRule} />}
        covered={outcome ? covered(outcome) : false}
        line={previewLines?.get(k.id)}
      />
    );
  };

  return (
    <div className="flex flex-col gap-4" data-testid="class-table">
      <p className="text-muted-foreground">{t("hint")}</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex min-w-64 flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("itemsOf")}</span>
          <select className={inputClass} value={rsId ?? ""} onChange={(e) => setRsId(e.target.value)} data-testid="class-rule-set">
            {ruleSets.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">{t("itemsOfHint")}</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {rs && <span className="text-muted-foreground tabular-nums">{t("coded", { coded, total: kinds.length })}</span>}
          <Button type="button" variant="outline" onClick={runSuggest} disabled={!rs || codeList.codes.length === 0} data-testid="class-suggest">
            {t("suggest")}
          </Button>
          {nSuggested > 0 && (
            <Button type="button" onClick={acceptAll} data-testid="class-accept-all">
              {t("acceptAll", { n: nSuggested })}
            </Button>
          )}
        </div>
      </div>
      {anyLine.length > 0 && (
        <section className="flex flex-col gap-2 border-t border-border pt-3">
          <h3 className="label-caps">{t("anyTitle")}</h3>
          <p className="text-muted-foreground">{t("anyHint")}</p>
          <ul className="flex flex-col gap-1">
            {anyLine.map(({ rule: r, index: i }) => (
              <li key={i}>
                {t.rich("anyRule", {
                  what: cap(w.match(r.match, label)),
                  code: w.code(r.code, titles),
                  id: r.id,
                  hasPriority: r.priority ? "yes" : "no",
                  priority: r.priority ?? 0,
                  b: (c) => <b>{c}</b>,
                  muted: (c) => <span className="text-muted-foreground">{c}</span>,
                  link: (c) => <NavLink onClick={() => onOpenRule(i)}>{c}</NavLink>,
                })}
              </li>
            ))}
          </ul>
        </section>
      )}
      {ruleSets.length === 0 && <p className="text-muted-foreground">{t("noRuleSets")}</p>}
      {rsError && (
        <p className="text-error" role="alert">
          {rsError}
        </p>
      )}
      {!rs && !rsError && ruleSets.length > 0 && <p className="text-muted-foreground">{t("loading")}</p>}

      {rs &&
        GROUPS.map((g) => {
          const list = kinds.filter((k) => k.group === g);
          if (!list.length) return null;
          return (
            <section key={g} className="flex flex-col" data-testid={`class-group-${g}`}>
              <h3 className="label-caps border-b border-border pb-1">{t(`groups.${g}`)}</h3>
              <RowHead />
              {list.map(row)}
            </section>
          );
        })}
      {rs && orphans.length > 0 && (
        <section className="flex flex-col">
          <h3 className="label-caps border-b border-border pb-1">{t("orphansTitle")}</h3>
          <p className="py-1 text-muted-foreground">{t("orphansHint")}</p>
          {orphans.map((id) => row({ id, label: id, group: "item", tags: [], orphan: true }))}
        </section>
      )}
    </div>
  );
}

const ROW_GRID = "grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,2fr)] md:gap-3";

function RowHead() {
  const t = useTranslations("classificationEditor.table");
  return (
    <div className={cn(ROW_GRID, "label-caps hidden border-b border-border py-1 text-muted-foreground md:grid")}>
      <span>{t("headKind")}</span>
      <span>{t("headSplit")}</span>
      <span>{t("headCode")}</span>
    </div>
  );
}

function Row({ kind, sub, cfg, onChange, termOptions, termLabel, via, suggestion, onAccept, outcome, covered, line }: {
  kind: LineKind;
  sub: string;
  /** Some rule (table or other) can give these lines a code. */
  covered: boolean;
  /** What decides this row's code, in words. */
  outcome?: ReactNode;
  cfg: RowConfig;
  onChange: (c: RowConfig) => void;
  termOptions: (k: SplitKind) => Term[];
  termLabel: (id: string) => string;
  via: [string, string | null][];
  suggestion?: string;
  onAccept?: () => void;
  /** The preview's first line of this BoQ item. */
  line?: PreviewLine;
}) {
  const t = useTranslations("classificationEditor.table");
  const { titles } = useCodes();
  const derived = kind.group === "derived";
  const empty = !cfg.code && !cfg.values.some((v) => v.code);
  const setSplit = (s: SplitKind) =>
    onChange({
      split: s,
      code: cfg.code,
      values: s === "none" ? [] : s === "external" ? [{ value: "true", code: null }, { value: "false", code: null }] : s === cfg.split ? cfg.values : [],
    });
  const valueLabel = (v: string) => (cfg.split === "external" ? (v === "true" ? t("outside") : t("inside")) : termLabel(v));
  const opts = termOptions(cfg.split).filter((x) => !cfg.values.some((v) => v.value === x.id));
  const uncoded = empty && !covered;
  return (
    <div
      className={cn(ROW_GRID, "border-b border-border py-2", uncoded && "border-l-2 border-l-muted-foreground pl-2")}
      title={uncoded ? t("uncoded") : undefined}
      data-testid="class-row"
      data-kind={kind.id}
    >
      <span className="flex min-w-0 flex-col">
        <b className="break-words">{kind.label}</b>
        {sub && <span className="text-muted-foreground">{sub}</span>}
      </span>
      <span>
        <Select value={cfg.split} options={SPLIT_KINDS} labels={(s) => t(`split.${s}`)} onChange={(s) => setSplit(s ?? "none")} aria-label={t("splitFor", { what: kind.label })} />
      </span>
      <span className="flex min-w-0 flex-col gap-2">
        {cfg.split !== "none" &&
          cfg.values.map((v, i) => (
            <div key={v.value || i} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-start gap-2">
              <span className="flex items-center gap-1 pt-1.5">
                <span className="truncate">{valueLabel(v.value)}</span>
                {cfg.split !== "external" && (
                  <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={t("remove", { what: valueLabel(v.value) })} onClick={() => onChange({ ...cfg, values: cfg.values.filter((_, j) => j !== i) })}>
                    ×
                  </button>
                )}
              </span>
              <TargetPicker value={v.code} derived={derived} line={line} label={t("codeFor", { what: valueLabel(v.value) })} onChange={(x) => onChange({ ...cfg, values: cfg.values.map((y, j) => (j === i ? { ...y, code: x } : y)) })} />
            </div>
          ))}
        {(cfg.split === "material" || cfg.split === "element_type") && opts.length > 0 && (
          <select className={inputClass} value="" onChange={(e) => e.target.value && onChange({ ...cfg, values: [...cfg.values, { value: e.target.value, code: null }] })} aria-label={t("addValue", { kind: cfg.split })}>
            <option value="">{t("addValue", { kind: cfg.split })}</option>
            {opts.map((x) => (
              <option key={x.id} value={x.id}>
                {t("termOption", { label: x.label, id: x.id })}
              </option>
            ))}
          </select>
        )}
        <div className={cn(cfg.split !== "none" && "grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-start gap-2")}>
          {cfg.split !== "none" && <span className="pt-1.5 text-muted-foreground">{cfg.split === "external" ? t("notKnown") : t("everythingElse")}</span>}
          <TargetPicker value={cfg.code} derived={derived} line={line} label={t("codeFor", { what: kind.label })} onChange={(x) => onChange({ ...cfg, code: x })} />
        </div>
        {suggestion && empty && (
          <span data-testid="class-suggestion">
            {t.rich("suggestion", { code: suggestion, title: titles.get(suggestion) ?? "", b: (c) => <b>{c}</b> })}
            <button type="button" className={cn(linkButton, "ml-2")} onClick={onAccept}>
              {t("use")}
            </button>
          </span>
        )}
        {outcome ??
          (empty && via.length > 0 && <span className="text-muted-foreground">{t("viaAdvanced", { list: via.map(([id, code]) => t("viaRule", { id, code: code ?? "…" })).join("; ") })}</span>)}
      </span>
    </div>
  );
}
