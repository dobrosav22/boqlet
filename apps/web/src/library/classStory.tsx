/**
 * Classifications in plain words: what a classification does, how a BoQ line gets its code, and
 * for each kind of BoQ line which map rules give it a code.
 *
 * "Which rules apply" is worked out from what is known without a model: a rule aimed at a BoQ
 * item (by its id, its tags, or the kind of a hand-entered line) applies to that item's lines for
 * sure; a condition on line values (material, element type…) may apply to some of them. Conditions
 * are only shown in words, never evaluated (CLAUDE.md rule 4); the BoQ itself shows each line's code.
 */
import { useMemo, type ReactNode } from "react";
import type { ClassificationMap, CodeList, CodeTarget, LineMatch, MapRule, RuleSet } from "@ifc-boq/types";
import { lexicon } from "./readable";
import { prose } from "./itemStory";

/* ---------------------------------------------------------------- kinds of BoQ line */

export interface LineKind {
  id: string;
  label: string;
  group: "item" | "derived" | "manual";
  tags: string[];
  manualKind?: string;
  /** Derived items: the items they are calculated from. */
  from?: string[];
  sub: string;
}

export function lineKinds(rs: RuleSet): LineKind[] {
  return [
    ...rs.items.map((i): LineKind => ({ id: i.id, label: i.label || i.id, group: "item", tags: i.tags ?? [], sub: i.tags?.length ? `tags: ${i.tags.join(", ")}` : "" })),
    ...(rs.derived ?? []).map((d): LineKind => ({ id: d.id, label: d.label || d.id, group: "derived", tags: d.tags ?? [], from: d.from, sub: `from ${d.from.join(", ")}` })),
    ...(rs.manual ?? []).map(
      (m): LineKind => ({ id: m.id, label: typeof m.description === "string" ? m.description : m.id, group: "manual", tags: m.tags ?? [], manualKind: m.kind, sub: m.kind.replace(/_/g, " ") }),
    ),
  ];
}

/* ---------------------------------------------------------------- rules in words */

const asList = (v: string | string[]) => (Array.isArray(v) ? v : [v]);
const quoteList = (l: string[]) => l.map((x) => `“${x}”`).join(", ");

export function matchWords(m: LineMatch, label: (id: string) => string): string {
  const lex = lexicon({});
  const go = (x: LineMatch): string => {
    if ("all" in x) return x.all.map(go).join(" and ");
    if ("any" in x) return `either ${x.any.map(go).join(" or ")}`;
    if ("not" in x) return `not (${go(x.not)})`;
    if ("ruleId" in x) return `lines of ${quoteList(asList(x.ruleId).filter(Boolean).map(label)) || "(no item chosen)"}`;
    if ("tag" in x) return `lines of items tagged ${asList(x.tag).filter(Boolean).join(" or ") || "(no tag)"}`;
    if ("manualKind" in x) return `lines entered by hand (${asList(x.manualKind).join(", ").replace(/_/g, " ")})`;
    return x.where ? `lines where ${prose(x.where, lex)}` : "(an empty condition)";
  };
  return go(m);
}

export function codeWords(t: CodeTarget, titles: Map<string, string>): string {
  if (typeof t === "string") return t ? `${t} ${titles.get(t) ?? "(not in the code list)"}` : "(no code chosen)";
  if ("fromSource" in t) return "the code of the line it is calculated from";
  return `a code looked up by ${t.lookup.replace(/_/g, " ")} (${Object.keys(t.table).length} values${t.default ? `, otherwise ${t.default}` : ""})`;
}

/* ---------------------------------------------------------------- which rules give a line kind its code */

type Fit = { fit: "yes" } | { fit: "no" } | { fit: "maybe"; when: string };

/** Does a rule's match take this kind of line: for sure, not at all, or only when a condition holds? */
function fits(m: LineMatch, k: LineKind): Fit {
  const lex = lexicon({});
  if ("ruleId" in m) return { fit: asList(m.ruleId).includes(k.id) ? "yes" : "no" };
  if ("tag" in m) return { fit: asList(m.tag).some((t) => k.tags.includes(t)) ? "yes" : "no" };
  if ("manualKind" in m) return { fit: k.manualKind && asList(m.manualKind).includes(k.manualKind) ? "yes" : "no" };
  if ("where" in m) return { fit: "maybe", when: prose(m.where, lex) };
  if ("not" in m) {
    const f = fits(m.not, k);
    return f.fit === "yes" ? { fit: "no" } : f.fit === "no" ? { fit: "yes" } : { fit: "maybe", when: `not (${f.when})` };
  }
  const parts = ("all" in m ? m.all : m.any).map((x) => fits(x, k));
  const maybes = parts.filter((p): p is Extract<Fit, { fit: "maybe" }> => p.fit === "maybe").map((p) => p.when);
  if ("all" in m) return parts.some((p) => p.fit === "no") ? { fit: "no" } : maybes.length ? { fit: "maybe", when: maybes.join(" and ") } : { fit: "yes" };
  return parts.some((p) => p.fit === "yes") ? { fit: "yes" } : maybes.length ? { fit: "maybe", when: maybes.join(" or ") } : { fit: "no" };
}

/** Aimed at particular BoQ items (by id, tag or hand-entered kind), rather than at any line meeting a condition. */
export function aimed(m: LineMatch): boolean {
  if ("ruleId" in m || "tag" in m || "manualKind" in m) return true;
  if ("all" in m) return m.all.some(aimed);
  if ("any" in m) return m.any.every(aimed);
  return false;
}

export interface Step {
  rule: MapRule;
  index: number;
  /** Undefined: applies to every line of this kind. */
  when?: string;
  /** The code, resolved where it can be (a lookup by rule id; "same as source"). */
  code: CodeTarget;
}

export interface Outcome {
  /** Rules that win when their condition holds, before `base`. */
  ifs: Step[];
  /** The rule every other line of this kind falls to; undefined when none is sure to apply. */
  base?: Step;
  /** Rules by condition not aimed at any item that may also apply, when there is no base. */
  general: Step[];
}

const resolve = (t: CodeTarget, k: LineKind): CodeTarget =>
  typeof t === "object" && "lookup" in t && t.lookup === "rule_id" ? t.table[k.id] ?? t.default ?? "" : t;

/** How lines of one kind get their code from a map: higher priority first, ties to the earlier rule (as the engine does). */
export function outcomeFor(map: ClassificationMap, k: LineKind): Outcome {
  const order = map.rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => (b.rule.priority ?? 0) - (a.rule.priority ?? 0) || a.index - b.index);
  const ifs: Step[] = [];
  const general: Step[] = [];
  for (const { rule, index } of order) {
    const f = fits(rule.match, k);
    if (f.fit === "no") continue;
    const step: Step = { rule, index, code: resolve(rule.code, k), ...(f.fit === "maybe" ? { when: f.when } : {}) };
    if (f.fit === "yes") return { ifs, base: step, general: [] };
    (aimed(rule.match) ? ifs : general).push(step);
  }
  return { ifs, general };
}

/** One code a derived line will carry: follows "same as its source" one step. */
export function sourceCode(map: ClassificationMap, k: LineKind, kinds: LineKind[]): string | undefined {
  const src = kinds.find((x) => x.id === k.from?.[0]);
  const b = src && outcomeFor(map, src).base;
  return b && typeof b.code === "string" ? b.code : undefined;
}

/* ---------------------------------------------------------------- rendering */

export function OutcomeWords({ outcome, titles, kind, kinds, map, table, onOpenRule }: {
  outcome: Outcome;
  /** Indexes of the map rules the table writes. */
  table: Set<number>;
  titles: Map<string, string>;
  kind: LineKind;
  kinds: LineKind[];
  map: ClassificationMap;
  onOpenRule: (index: number) => void;
}) {
  const code = (s: Step): ReactNode => {
    if (typeof s.code === "object" && "fromSource" in s.code) {
      const c = sourceCode(map, kind, kinds);
      return <>the code of its source line{c ? ` (now ${c} ${titles.get(c) ?? ""})` : ""}</>;
    }
    return <b>{codeWords(s.code, titles)}</b>;
  };
  const by = (s: Step) =>
    table.has(s.index) ? (
      <span className="muted"> (this table)</span>
    ) : (
      <>
        {" "}
        <span className="muted">(</span>
        <button type="button" className="link small" onClick={() => onOpenRule(s.index)}>
          rule “{s.rule.id}”
        </button>
        <span className="muted">)</span>
      </>
    );
  const { ifs, base, general } = outcome;
  if (!ifs.length && !general.length && base && table.has(base.index)) return null; // the picker above says it all
  return (
    <span className="ct-outcome small">
      {ifs.map((s) => (
        <span key={s.index} className="block">
          When {s.when}: {code(s)}
          {by(s)}.
        </span>
      ))}
      {base ? (
        <span className="block">
          {ifs.length ? "Otherwise" : "All lines"}: {code(base)}
          {by(base)}.
        </span>
      ) : (
        <span className="block muted">
          {general.length
            ? `${ifs.length ? "Otherwise the" : "The"} rules for any line (above the table) decide, by the line's values.`
            : `${ifs.length ? "Otherwise no" : "No"} rule gives these lines a code.`}
        </span>
      )}
    </span>
  );
}

/** The classification in a few sentences: what it does and where a line's code comes from. */
export function ClassStory({ codeList, map, table, kinds, ruleSetName, onJump }: {
  codeList: CodeList;
  map: ClassificationMap;
  table: Set<number>;
  kinds: LineKind[] | null;
  ruleSetName?: string;
  onJump: (to: "table" | "codes" | "rules" | "settings") => void;
}) {
  const sources = map.sources ?? ["decision", "map"];
  const coverage = useMemo(() => {
    if (!kinds) return null;
    let sure = 0;
    let some = 0;
    for (const k of kinds) {
      const o = outcomeFor(map, k);
      if (o.base && !o.ifs.length) sure++;
      else if (o.base || o.ifs.length || o.general.length) some++;
    }
    return { sure, some, none: kinds.length - sure - some };
  }, [kinds, map]);
  const levels = codeList.levels?.length ? ` (${codeList.levels.join(" › ")})` : "";
  const byCondition = map.rules.length - table.size;
  const unm = map.onUnmapped;
  const Jump = ({ to, children }: { to: "table" | "codes" | "rules" | "settings"; children: ReactNode }) => (
    <span role="button" tabIndex={0} className="story-seg" onClick={() => onJump(to)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onJump(to))}>
      {children}
    </span>
  );
  const step: Record<"decision" | "ifc" | "map", ReactNode> = {
    decision: <>your answer for the project, if a line was asked about (BoQ › Questions);</>,
    ifc: (
      <>
        a code already on the elements in the IFC, when the model carries a classification named <Jump to="settings">{map.ifc?.systemNames.length ? map.ifc.systemNames.map((n) => `“${n}”`).join(" or ") : "(no name set)"}</Jump>;
      </>
    ),
    map: (
      <>
        this classification's rules: <Jump to="table">the table, one code per kind of BoQ line</Jump>
        {byCondition > 0 && (
          <>
            , and <Jump to="rules">{byCondition} rule{byCondition === 1 ? "" : "s"} by condition</Jump>
          </>
        )}
        ; when several apply, the higher priority wins{map.onConflict === "ask" ? " and a tie is asked about" : ""};
      </>
    ),
  };
  return (
    <div className="story">
      <p>
        <b>{codeList.name || codeList.id}</b> puts a code from <Jump to="codes">its list of {codeList.codes.length} codes{levels}</Jump> on every BoQ line, so the BoQ can be grouped and
        subtotalled by them. It never changes a quantity.
      </p>
      <p className="story-meta">A line gets its code from the first of these that gives one:</p>
      <ol className="story-steps">
        {sources.map((s) => (
          <li key={s}>{step[s]}</li>
        ))}
        <li>
          otherwise the line{" "}
          <Jump to="settings">
            {unm === "flag" ? "stays without a code" : unm === "ask" ? "is asked about (it does not block the BoQ)" : `gets ${unm.code} ${codeList.codes.find((c) => c.code === unm.code)?.title ?? ""}`}
          </Jump>
          .
        </li>
      </ol>
      {coverage && (
        <p className="story-meta">
          With the items of {ruleSetName ?? "the chosen rule set"}: {coverage.sure} of {kinds!.length} kinds of line always get a code, {coverage.some} only in some cases, {coverage.none} none.
        </p>
      )}
    </div>
  );
}
