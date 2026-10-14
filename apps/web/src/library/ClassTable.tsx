/**
 * Classification as a table: one row per kind of BoQ line (the rules of a rule set, usually the
 * master template), one code per row picked from the code list. A row can be split by a fixed
 * choice of line field (inside/outside, material, element type) with a code per value.
 *
 * The table reads and writes ordinary map rules in a fixed shape, so the engine needs nothing new:
 *   plain    { match: { ruleId: X }, code, priority: 5 }
 *   split    { match: { all: [ { ruleId: X }, { where: <canonical condition> } ] }, code, priority: 6 }
 * Rules of any other shape stay "advanced": they still apply, but table rows take priority.
 */
import { useId, useMemo, useState, type ReactNode } from "react";
import type { ClassificationMap, CodeList, CodeTarget, MapRule, PresetsResponse } from "@ifc-boq/types";
import { Options, Select, Text } from "./fields";
import { OutcomeWords, aimed, codeWords, matchWords, outcomeFor, type LineKind } from "./classStory";

/* ================================================================ the table <-> map rules */

type SplitKind = "none" | "external" | "material" | "element_type";
type Target = string | { fromSource: true } | null; // null = no code from the table

interface RowConfig {
  split: SplitKind;
  /** No split: the row's code. Split: the code for "everything else". */
  code: Target;
  values: { value: string; code: Target }[];
}

const SPLIT_LABEL: Record<SplitKind, string> = {
  none: "not split",
  external: "inside / outside",
  material: "material",
  element_type: "element type",
};

const whereFor = (kind: SplitKind, value: string) =>
  kind === "external" ? `is_external = ${value}` : `UNDER(${kind}, "${value}")`;

function parseWhere(w: string): { kind: SplitKind; value: string } | null {
  let m = /^is_external = (true|false)$/.exec(w.trim());
  if (m) return { kind: "external", value: m[1] };
  m = /^UNDER\((material|element_type), "([^"]+)"\)$/.exec(w.trim());
  return m ? { kind: m[1] as SplitKind, value: m[2] } : null;
}

const asTarget = (c: CodeTarget): Target | undefined =>
  typeof c === "string" ? c : "fromSource" in c ? { fromSource: true } : undefined;

/** Which map rules the table understands, per line kind; the rest are advanced. */
export function readTable(map: ClassificationMap) {
  const rows = new Map<string, RowConfig>();
  const used = new Set<number>();
  map.rules.forEach((r, i) => {
    const t = asTarget(r.code);
    if (t === undefined) return;
    const m = r.match as Record<string, unknown>;
    if (Object.keys(m).length === 1 && typeof m.ruleId === "string") {
      const row = rows.get(m.ruleId) ?? { split: "none", code: null, values: [] };
      if (row.code !== null) return; // a second plain rule for the same line kind: advanced
      rows.set(m.ruleId, { ...row, code: t });
      used.add(i);
      return;
    }
    const all = m.all as Record<string, unknown>[] | undefined;
    if (Object.keys(m).length === 1 && all?.length === 2 && typeof all[0].ruleId === "string" && Object.keys(all[0]).length === 1 && typeof all[1].where === "string") {
      const w = parseWhere(all[1].where as string);
      const id = all[0].ruleId as string;
      const row = rows.get(id) ?? { split: "none", code: null, values: [] };
      if (!w || (row.split !== "none" && row.split !== w.kind)) return;
      rows.set(id, { ...row, split: w.kind, values: [...row.values, { value: w.value, code: t }] });
      used.add(i);
    }
  });
  return { rows, used };
}

/** Replace the table's rules for one line kind. New rules go first, so they win ties. */
function writeRow(map: ClassificationMap, id: string, cfg: RowConfig): ClassificationMap {
  const { used } = readTable(map);
  const mine = (r: MapRule, i: number) => {
    if (!used.has(i)) return false;
    const m = r.match as { ruleId?: string; all?: { ruleId?: string }[] };
    return m.ruleId === id || m.all?.[0]?.ruleId === id;
  };
  const kept = map.rules.filter((r, i) => !mine(r, i));
  const depth = (v: string) => v.split(".").length;
  const fresh: MapRule[] = [];
  if (cfg.split !== "none")
    for (const v of [...cfg.values].sort((a, b) => depth(b.value) - depth(a.value)))
      if (v.code && v.value)
        fresh.push({ id: `t-${id}-${v.value}`, match: { all: [{ ruleId: id }, { where: whereFor(cfg.split, v.value) }] }, code: v.code, priority: 6 });
  if (cfg.code) fresh.push({ id: `t-${id}`, match: { ruleId: id }, code: cfg.code, priority: 5 });
  return { ...map, rules: [...fresh, ...kept] };
}

const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/* ================================================================ suggestions */

const STOP = new Set(["to", "of", "and", "the", "in", "for", "from", "a", "an", "with", "by", "estimate", "estimated", "other"]);
const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => w.replace(/(ings|ing|es|s)$/, ""));

/** Best code for a line kind by word overlap with code titles; deeper (more specific) codes win ties. */
function suggest(label: string, codes: CodeList["codes"]): string | null {
  const want = new Set(words(label));
  let best: { code: string; score: number } | null = null;
  for (const c of codes) {
    const have = words(c.title);
    const hits = have.filter((w) => want.has(w)).length;
    if (!hits) continue;
    const score = hits / Math.sqrt(have.length) + c.code.length * 0.001;
    if (!best || score > best.score) best = { code: c.code, score };
  }
  return best?.code ?? null;
}

/* ================================================================ pickers */

export function CodePicker({ value, onChange, titles }: { value: string | undefined; onChange: (v: string | undefined) => void; titles: Map<string, string> }) {
  const id = useId();
  return (
    <span className="code-pick">
      <Text mono list={id} value={value} onChange={onChange} placeholder="code" />
      <Options id={id} values={[...titles.keys()]} labels={Object.fromEntries(titles)} />
      {value && <span className={titles.has(value) ? "muted small" : "error small"}>{titles.get(value) ?? "not in the code list"}</span>}
    </span>
  );
}

function TargetPicker({ value, onChange, titles, derived }: { value: Target; onChange: (t: Target) => void; titles: Map<string, string>; derived: boolean }) {
  const fromSource = !!value && typeof value === "object";
  return (
    <div className="tpick">
      {derived && (
        <Select
          value={fromSource ? "source" : "code"}
          options={["code", "source"] as const}
          labels={{ code: "a code", source: "same as its source line" }}
          onChange={(v) => onChange(v === "source" ? { fromSource: true } : null)}
        />
      )}
      {!fromSource && <CodePicker value={typeof value === "string" ? value : undefined} onChange={(v) => onChange(v ?? null)} titles={titles} />}
    </div>
  );
}

/* ================================================================ the tab */

export interface RuleSetOption {
  id: string;
  name: string;
}

const GROUP_TITLE = { item: "Measured from the model", derived: "Calculated from other items (formwork, paint, estimates…)", manual: "Entered by hand" };

export function ClassTable({ codeList, map, onChange, presets, ruleSets, rsId, setRsId, kinds: loaded, rsError, onOpenRule }: {
  codeList: CodeList;
  map: ClassificationMap;
  onChange: (m: ClassificationMap) => void;
  presets: PresetsResponse | null;
  ruleSets: RuleSetOption[];
  rsId: string | undefined;
  setRsId: (id: string) => void;
  /** The BoQ items of the chosen rule set; null while loading. */
  kinds: LineKind[] | null;
  rsError: string | null;
  /** Show a map rule in Advanced (by its index in map.rules). */
  onOpenRule: (index: number) => void;
}) {
  const [suggested, setSuggested] = useState<Record<string, string>>({});
  /** Rows being edited: a split whose values have no code yet has no map rule to read back from. */
  const [pending, setPending] = useState<Record<string, RowConfig>>({});
  const rs = loaded;

  const titles = useMemo(() => new Map(codeList.codes.map((c) => [c.code, c.title])), [codeList]);
  const { rows, used } = readTable(map);
  const advanced = map.rules.filter((_, i) => !used.has(i));
  /** Rules not aimed at any BoQ item: shown once above the table instead of under every row. */
  const anyLine = map.rules
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => !used.has(i) && !aimed(r.match))
    .sort((a, b) => (b.r.priority ?? 0) - (a.r.priority ?? 0) || a.i - b.i);
  const kinds = loaded ?? [];
  const orphans = [...rows.keys()].filter((id) => !kinds.some((k) => k.id === id));
  const terms = presets?.terms ?? [];
  const termOptions = (kind: SplitKind) => terms.filter((t) => (kind === "material" ? t.category === "material" || t.category === "product" : t.category === "element_type"));
  const termLabel = (id: string) => terms.find((t) => t.id === id)?.label ?? id;

  const cfgOf = (id: string): RowConfig => pending[id] ?? rows.get(id) ?? { split: "none", code: null, values: [] };
  const setRow = (id: string, cfg: RowConfig) => {
    onChange(writeRow(map, id, cfg));
    setPending((p) => ({ ...p, [id]: cfg }));
    setSuggested(({ [id]: _drop, ...rest }) => rest);
  };
  const coded = kinds.filter((k) => cfgOf(k.id).code || cfgOf(k.id).values.some((v) => v.code)).length;

  /** Advanced rules that name this line kind directly (by rule id or a rule-id lookup). */
  const viaAdvanced = (id: string) =>
    advanced.flatMap((r) => {
      const m = r.match as { ruleId?: string | string[] };
      const ids = m.ruleId === undefined ? [] : Array.isArray(m.ruleId) ? m.ruleId : [m.ruleId];
      const lookup = typeof r.code === "object" && "lookup" in r.code && r.code.lookup === "rule_id" ? r.code.table[id] : undefined;
      if (lookup) return [`${r.id} → ${lookup}`];
      if (ids.includes(id)) return [`${r.id} → ${typeof r.code === "string" ? r.code : "…"}`];
      return [];
    });

  const runSuggest = () => {
    const out: Record<string, string> = {};
    for (const k of kinds) {
      const c = cfgOf(k.id);
      if (c.code || c.values.length || viaAdvanced(k.id).length) continue;
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

  return (
    <div className="ctable">
      <p className="hint">
        One row per BoQ item: every line that item makes gets the code picked here. Split a row when its lines need different codes, e.g. external and internal walls. Under a row:
        what else decides its code (rules by condition, which win when they have a higher priority).
      </p>
      <div className="ct-tools">
        <label className="f">
          <span className="f-label">BoQ items of</span>
          <select value={rsId} onChange={(e) => setRsId(e.target.value)}>
            {ruleSets.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <span className="f-hint">Rule sets built on As modelled share its items, so one table serves all of them.</span>
        </label>
        <div className="ct-actions">
          {rs && (
            <span className="small muted">
              {coded} of {kinds.length} rows coded in the table
            </span>
          )}
          <button type="button" className="ghost small-btn" onClick={runSuggest} disabled={!rs || codeList.codes.length === 0}>
            Suggest codes
          </button>
          {Object.keys(suggested).length > 0 && (
            <button type="button" className="primary small-btn" onClick={acceptAll}>
              Accept {Object.keys(suggested).length} suggestions
            </button>
          )}
        </div>
      </div>
      {anyLine.length > 0 && (
        <section className="ct-any">
          <h3>Rules for any line</h3>
          <p className="hint">
            These look at a line's values (material, element type…), not at which BoQ item made it, so they can apply to any row below that has no code of its own, or one with a lower
            priority. Highest priority first.
          </p>
          <ul>
            {anyLine.map(({ r, i }) => (
              <li key={i}>
                {cap(matchWords(r.match, (id) => kinds.find((k) => k.id === id)?.label ?? id))}: <b>{codeWords(r.code, titles)}</b>{" "}
                <span className="muted">(</span>
                <button type="button" className="link small" onClick={() => onOpenRule(i)}>
                  rule “{r.id}”
                </button>
                <span className="muted">{r.priority ? `, priority ${r.priority}` : ""})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rsError && <p className="error">{rsError}</p>}
      {!rs && !rsError && <p className="muted">Loading the rule set…</p>}

      {rs &&
        (["item", "derived", "manual"] as const).map((g) => {
          const list = kinds.filter((k) => k.group === g);
          if (!list.length) return null;
          return (
            <section key={g} className="ct-group">
              <h3>{GROUP_TITLE[g]}</h3>
              <div className="ct-row ct-head">
                <span>Line kind</span>
                <span>Split by</span>
                <span>Code</span>
              </div>
              {list.map((k) => (
                <Row
                  key={k.id}
                  kind={k}
                  cfg={cfgOf(k.id)}
                  onChange={(c) => setRow(k.id, c)}
                  titles={titles}
                  termOptions={termOptions}
                  termLabel={termLabel}
                  via={viaAdvanced(k.id)}
                  suggestion={suggested[k.id]}
                  onAccept={() => setRow(k.id, { ...cfgOf(k.id), code: suggested[k.id] })}
                  outcome={<OutcomeWords outcome={outcomeFor(map, k)} titles={titles} kind={k} kinds={kinds} map={map} table={used} onOpenRule={onOpenRule} />}
                  covered={(({ base, ifs, general }) => !!base || ifs.length > 0 || general.length > 0)(outcomeFor(map, k))}
                />
              ))}
            </section>
          );
        })}
      {rs && orphans.length > 0 && (
        <section className="ct-group">
          <h3>Rows for lines this rule set does not have</h3>
          <p className="hint">Kept for other rule sets that do have them.</p>
          {orphans.map((id) => (
            <Row
              key={id}
              kind={{ id, label: id, group: "item", tags: [], sub: "not in this rule set" }}
              cfg={cfgOf(id)}
              onChange={(c) => setRow(id, c)}
              titles={titles}
              termOptions={termOptions}
              termLabel={termLabel}
              via={[]}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function Row({ kind, cfg, onChange, titles, termOptions, termLabel, via, suggestion, onAccept, outcome, covered }: {
  kind: LineKind;
  /** Some rule (table or other) can give these lines a code. */
  covered?: boolean;
  /** What decides this row's code, in words. */
  outcome?: ReactNode;
  cfg: RowConfig;
  onChange: (c: RowConfig) => void;
  titles: Map<string, string>;
  termOptions: (k: SplitKind) => { id: string; label: string }[];
  termLabel: (id: string) => string;
  via: string[];
  suggestion?: string;
  onAccept?: () => void;
}) {
  const derived = kind.group === "derived";
  const empty = !cfg.code && !cfg.values.some((v) => v.code);
  const setSplit = (s: SplitKind) =>
    onChange({
      split: s,
      code: cfg.code,
      values: s === "none" ? [] : s === "external" ? [{ value: "true", code: null }, { value: "false", code: null }] : s === cfg.split ? cfg.values : [],
    });
  const valueLabel = (v: string) => (cfg.split === "external" ? (v === "true" ? "Outside (external)" : "Inside (internal)") : termLabel(v));
  const opts = termOptions(cfg.split).filter((t) => !cfg.values.some((v) => v.value === t.id));
  return (
    <div className={`ct-row ${empty && !covered ? "uncoded" : ""}`} title={empty && !covered ? "Nothing gives these lines a code" : undefined}>
      <span className="ct-kind">
        <b>{kind.label}</b>
        <span className="muted small block">{kind.sub}</span>
      </span>
      <span>
        <Select value={cfg.split} options={["none", "external", "material", "element_type"] as const} labels={SPLIT_LABEL} onChange={(s) => setSplit(s ?? "none")} />
      </span>
      <span className="ct-codes">
        {cfg.split !== "none" &&
          cfg.values.map((v, i) => (
            <div key={v.value || i} className="ct-split">
              <span className="ct-value">
                {valueLabel(v.value)}
                {cfg.split !== "external" && (
                  <button type="button" className="icon" aria-label={`Remove ${valueLabel(v.value)}`} onClick={() => onChange({ ...cfg, values: cfg.values.filter((_, j) => j !== i) })}>
                    ×
                  </button>
                )}
              </span>
              <TargetPicker value={v.code} derived={derived} titles={titles} onChange={(t) => onChange({ ...cfg, values: cfg.values.map((x, j) => (j === i ? { ...x, code: t } : x)) })} />
            </div>
          ))}
        {(cfg.split === "material" || cfg.split === "element_type") && opts.length > 0 && (
          <select className="ct-add" value="" onChange={(e) => e.target.value && onChange({ ...cfg, values: [...cfg.values, { value: e.target.value, code: null }] })}>
            <option value="">+ own code for a {cfg.split === "material" ? "material" : "element type"}…</option>
            {opts.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} ({t.id})
              </option>
            ))}
          </select>
        )}
        <div className="ct-split">
          {cfg.split !== "none" && <span className="ct-value muted">{cfg.split === "external" ? "Not known" : "Everything else"}</span>}
          <TargetPicker value={cfg.code} derived={derived} titles={titles} onChange={(t) => onChange({ ...cfg, code: t })} />
        </div>
        {suggestion && empty && (
          <span className="ct-suggest small">
            Suggestion: <b>{suggestion}</b> {titles.get(suggestion)}{" "}
            <button type="button" className="link small" onClick={onAccept}>
              use
            </button>
          </span>
        )}
        {outcome ?? (empty && via.length > 0 && <span className="muted small">Coded by advanced rule {via.join("; ")}</span>)}
      </span>
    </div>
  );
}
