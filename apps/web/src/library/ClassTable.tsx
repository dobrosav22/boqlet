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
import { useEffect, useId, useMemo, useState } from "react";
import type { ClassificationMap, CodeList, CodeTarget, MapRule, PresetsResponse, RuleSet } from "@ifc-boq/types";
import { Options, Select, Text } from "./fields";

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
function readTable(map: ClassificationMap) {
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

interface LineKind {
  id: string;
  label: string;
  group: "item" | "derived" | "manual";
  sub: string;
}

function lineKinds(rs: RuleSet): LineKind[] {
  return [
    ...rs.items.map((i): LineKind => ({ id: i.id, label: i.label || i.id, group: "item", sub: i.tags?.join(", ") ?? "" })),
    ...(rs.derived ?? []).map((d): LineKind => ({ id: d.id, label: d.label || d.id, group: "derived", sub: `from ${d.from.join(", ")}` })),
    ...(rs.manual ?? []).map((m): LineKind => ({ id: m.id, label: typeof m.description === "string" ? m.description : m.id, group: "manual", sub: m.kind.replace(/_/g, " ") })),
  ];
}

const GROUP_TITLE = { item: "Measured items", derived: "Derived items (formwork, paint, estimates…)", manual: "Items with no model behind them" };

export function ClassTable({ codeList, map, onChange, presets, ruleSets, loadRuleSet, onAdvanced }: {
  codeList: CodeList;
  map: ClassificationMap;
  onChange: (m: ClassificationMap) => void;
  presets: PresetsResponse | null;
  ruleSets: RuleSetOption[];
  loadRuleSet: (id: string) => Promise<RuleSet | null>;
  onAdvanced: () => void;
}) {
  const [rsId, setRsId] = useState(ruleSets.some((r) => r.id === "as-modelled") ? "as-modelled" : ruleSets[0]?.id);
  const [rs, setRs] = useState<RuleSet | null>(null);
  const [rsError, setRsError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<Record<string, string>>({});
  /** Rows being edited: a split whose values have no code yet has no map rule to read back from. */
  const [pending, setPending] = useState<Record<string, RowConfig>>({});
  useEffect(() => {
    if (!rsId) return;
    let live = true;
    setRs(null);
    setRsError(null);
    loadRuleSet(rsId)
      .then((r) => live && (r ? setRs(r) : setRsError("This rule set cannot be resolved; check it in the Library.")))
      .catch((e: Error) => live && setRsError(e.message));
    return () => {
      live = false;
    };
  }, [rsId, loadRuleSet]);

  const titles = useMemo(() => new Map(codeList.codes.map((c) => [c.code, c.title])), [codeList]);
  const { rows, used } = readTable(map);
  const advanced = map.rules.filter((_, i) => !used.has(i));
  const kinds = rs ? lineKinds(rs) : [];
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

  const unm = map.onUnmapped;
  return (
    <div className="ctable">
      <p className="hint">
        Pick a code for each kind of BoQ line. Lines are the rules of a rule set; every standard built on the master template has the same ones, so one table works for all of them.
        Split a row when one kind of line needs different codes, e.g. external and internal walls.
      </p>
      <div className="ct-tools">
        <label className="f">
          <span className="f-label">Lines from rule set</span>
          <select value={rsId} onChange={(e) => setRsId(e.target.value)}>
            {ruleSets.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="f">
          <span className="f-label">Lines with no code</span>
          <select
            value={typeof unm === "string" ? unm : "code"}
            onChange={(e) => onChange({ ...map, onUnmapped: e.target.value === "code" ? { code: codeList.codes[0]?.code ?? "" } : (e.target.value as "flag" | "ask") })}
          >
            <option value="flag">stay without a code</option>
            <option value="ask">ask the user (non-blocking)</option>
            <option value="code">get a default code</option>
          </select>
        </label>
        {typeof unm === "object" && (
          <div className="f">
            <span className="f-label">Default code</span>
            <CodePicker value={unm.code} onChange={(c) => onChange({ ...map, onUnmapped: { code: c ?? "" } })} titles={titles} />
          </div>
        )}
        <div className="ct-actions">
          {rs && (
            <span className="small muted">
              {coded} of {kinds.length} line kinds coded here
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
      {advanced.length > 0 && (
        <p className="note small">
          This map also has {advanced.length} advanced rule{advanced.length === 1 ? "" : "s"} (conditions on tags, materials, expressions). They still apply; a code set in this table
          takes priority.{" "}
          <button type="button" className="link small" onClick={onAdvanced}>
            Show advanced rules
          </button>
        </p>
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
              kind={{ id, label: id, group: "item", sub: "not in this rule set" }}
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

function Row({ kind, cfg, onChange, titles, termOptions, termLabel, via, suggestion, onAccept }: {
  kind: LineKind;
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
    <div className={`ct-row ${empty ? "uncoded" : ""}`}>
      <span className="ct-kind">
        <b>{kind.label}</b>
        <span className="muted small block">
          <code>{kind.id}</code>
          {kind.sub ? ` · ${kind.sub}` : ""}
        </span>
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
        {empty && via.length > 0 && <span className="muted small">Coded by advanced rule {via.join("; ")}</span>}
      </span>
    </div>
  );
}
