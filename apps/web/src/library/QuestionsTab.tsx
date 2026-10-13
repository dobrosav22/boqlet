/**
 * The settings questionnaire: a rule set's slots asked as plain questions, grouped by section.
 *
 * On a set that extends another (a company's standard on top of the master template), every
 * question shows the inherited default and "your answer"; only answers that differ are stored.
 * Follow-up questions sit under the question they depend on and are hidden while it does not
 * apply. The rules behind each question stay one click away ("Used by …"), so nothing is hidden.
 */
import { useState } from "react";
import type { OurRuleType, Param, RuleSection, RuleSet } from "@ifc-boq/types";
import { ExprInput, Num, Select, Text, fmtParam } from "./fields";
import { sameFormula } from "./readable";
import { effectiveSections } from "./QuestionSetup";
import { isPatch, put } from "./store";

type Slots = Record<string, Param>;
type Value = Param["value"];

/** An item that a yes/no answer switches on or off (its `enabled` points at the slot). */
export interface ScopeEntry {
  slot: string;
  label: string;
  on: boolean;
}

interface Props {
  doc: OurRuleType;
  onChange: (d: OurRuleType) => void;
  parent: RuleSet | null;
  slots: Slots;
  usage: Record<string, string[]>;
  scope: ScopeEntry[];
  ruleLabel: (id: string) => string;
  onOpenRule: (id: string) => void;
  onOpenSetup: () => void;
}

export function QuestionsTab({ doc, onChange, parent, slots, usage, scope, ruleLabel, onOpenRule, onOpenSetup }: Props) {
  const patch = isPatch(doc);
  const own = (doc.params ?? {}) as Record<string, Param | { value: Value }>;
  const sections: RuleSection[] = effectiveSections(doc, parent);
  const [onlyChanged, setOnlyChanged] = useState(false);

  const names = Object.keys(slots);
  const bySection = new Map<string, string[]>();
  for (const n of names) {
    const s = sections.some((x) => x.id === slots[n].section) ? slots[n].section! : "_other";
    bySection.set(s, [...(bySection.get(s) ?? []), n]);
  }
  const groups: RuleSection[] = [...sections, { id: "_other", title: "Other settings", intro: "Slots not yet placed in a section." }].filter((s) => bySection.has(s.id));

  /** The value this set would use if it did not answer (patches: the parent's). */
  const defaultOf = (n: string): Value | undefined => (patch ? parent?.params[n]?.value : undefined);
  const answered = (n: string) => patch && n in own && defaultOf(n) !== undefined && JSON.stringify(slots[n].value) !== JSON.stringify(defaultOf(n));
  const changedCount = names.filter(answered).length;

  const setValue = (n: string, v: Value) => {
    const mine = own[n];
    let next: Param | { value: Value } | undefined;
    if (mine && "type" in mine) next = { ...mine, value: v } as Param;
    else if (patch && defaultOf(n) !== undefined && JSON.stringify(defaultOf(n)) === JSON.stringify(v)) next = undefined;
    else if (patch) next = { value: v };
    else next = { ...slots[n], value: v } as Param;
    onChange({ ...doc, params: put(own, n, next) } as OurRuleType);
  };
  const useDefault = (n: string) => onChange({ ...doc, params: put(own, n, undefined) } as OurRuleType);

  /** The question applies: what it depends on has one of the listed answers, and applies itself. */
  const applies = (n: string, depth = 0): boolean => {
    const d = slots[n].dependsOn;
    return !d || depth > 8 || (d.values.some((v) => JSON.stringify(v) === JSON.stringify(slots[d.param]?.value)) && (!slots[d.param] || applies(d.param, depth + 1)));
  };
  /** Questions that depend on n, in their original order. */
  const followUps = (n: string, within: string[]) => within.filter((m) => slots[m].dependsOn?.param === n);
  /** Section order with each follow-up placed right after the question it depends on. */
  const ordered = (list: string[]): { n: string; depth: number }[] => {
    const out: { n: string; depth: number }[] = [];
    const add = (n: string, depth: number) => {
      out.push({ n, depth });
      for (const m of followUps(n, list)) add(m, depth + 1);
    };
    for (const n of list) if (!list.includes(slots[n].dependsOn?.param ?? "")) add(n, 0);
    return out;
  };

  if (!patch && sections.length === 0 && names.length === 0)
    return <p className="muted">This rule set has no questions yet. Add them under Advanced › Questions setup, with a section and a question, and they appear here.</p>;

  const included = scope.filter((s) => s.on);
  const excluded = scope.filter((s) => !s.on);
  const jump = (slot: string) => document.getElementById(`slot-${slot}`)?.scrollIntoView({ behavior: "smooth", block: "center" });

  return (
    <div className="questions-tab">
      <div className="q-intro">
        <p>
          {patch ? (
            <>
              Answer the questions as your rulebook does. Anything you leave keeps the answer from <b>{(doc as { extends: string }).extends}</b>
              {parent?.name ? <> ({parent.name})</> : null}. Only your differing answers are stored.
            </>
          ) : (
            <>These are the questions this rule set asks. Their values here are the defaults every set extending it starts from.</>
          )}
        </p>
        {scope.length > 0 && (
          <div className="q-scope">
            <p>
              <b>In this BoQ:</b>{" "}
              {included.length ? included.map((s, i) => <ScopeLink key={s.label} s={s} first={i === 0} onJump={jump} />) : <span className="muted">none of the optional items</span>}
            </p>
            {excluded.length > 0 && (
              <p className="muted">
                <b>Not in it:</b> {excluded.map((s, i) => <ScopeLink key={s.label} s={s} first={i === 0} onJump={jump} />)}
              </p>
            )}
          </div>
        )}
        <div className="q-nav">
          {groups.map((g) => (
            <a key={g.id} href={`#q-${g.id}`} className="chip">
              {g.title}
              {patch && (bySection.get(g.id) ?? []).some(answered) && <span className="q-count">{(bySection.get(g.id) ?? []).filter(answered).length}</span>}
            </a>
          ))}
          {patch && (
            <label className="option inline q-only">
              <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} />
              <span>
                Only my answers ({changedCount} of {names.length})
              </span>
            </label>
          )}
        </div>
      </div>

      {groups.map((g) => {
        const all = bySection.get(g.id) ?? [];
        const list = ordered(all).filter(({ n }) => (onlyChanged ? answered(n) : applies(n)));
        if (list.length === 0) return null;
        return (
          <section key={g.id} id={`q-${g.id}`} className="q-section">
            <h2>{g.title}</h2>
            {g.intro && <p className="hint">{g.intro}</p>}
            {list.map(({ n, depth }) => {
              const p = slots[n];
              const dflt = defaultOf(n);
              const mine = answered(n);
              const hidden = followUps(n, names).filter((m) => !applies(m)).length;
              return (
                <div key={n} id={`slot-${n}`} className={`qcard ${mine ? "mine" : ""} ${depth ? "sub" : ""}`} style={depth ? { marginLeft: 22 * depth } : undefined}>
                  <div className="qcard-text">
                    <div className="qcard-q" title={`Stored as ${n}`}>
                      {p.question ?? p.label}
                    </div>
                    {p.help && <p className="qcard-help">{p.help}</p>}
                    {p.example && (
                      <details>
                        <summary>Example</summary>
                        <p className="qcard-help">{p.example}</p>
                      </details>
                    )}
                    <div className="qcard-meta">
                      {hidden > 0 && !onlyChanged && (
                        <span>
                          {hidden} follow-up question{hidden === 1 ? "" : "s"} for other answers
                        </span>
                      )}
                      {(usage[n] ?? []).length > 0 ? (
                        <span>
                          Used by{" "}
                          {usage[n].map((id, i) => (
                            <span key={id}>
                              {i > 0 && ", "}
                              <button type="button" className="link" onClick={() => onOpenRule(id)} title="Open the item that uses this answer">
                                {ruleLabel(id)}
                              </button>
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span>Not used by any item yet</span>
                      )}
                    </div>
                  </div>
                  <div className="qcard-answer">
                    <Answer p={p} slots={slots} onChange={(v) => setValue(n, v)} />
                    {patch && dflt !== undefined && (
                      <div className="qcard-default">
                        {mine ? (
                          <>
                            <span className="badge badge-changed">your answer</span>
                            <span>
                              default: {fmtAnswer(slots[n], dflt)}{" "}
                              <button type="button" className="link small" onClick={() => useDefault(n)}>
                                use default
                              </button>
                            </span>
                          </>
                        ) : (
                          <span className="muted">default</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
      <p className="hint">
        Missing a question your rulebook answers?{" "}
        <button type="button" className="link small" onClick={onOpenSetup}>
          Add one
        </button>{" "}
        under Advanced › Questions setup and point an item at it, or change the item itself under BoQ items.
      </p>
    </div>
  );
}

function ScopeLink({ s, first, onJump }: { s: ScopeEntry; first: boolean; onJump: (slot: string) => void }) {
  return (
    <>
      {!first && ", "}
      <button type="button" className="link" onClick={() => onJump(s.slot)}>
        {s.label}
      </button>
    </>
  );
}

function fmtAnswer(p: Param, v: Value): string {
  if (p.type === "choice" && typeof v === "string") return p.optionLabels?.[v] ?? v.replace(/_/g, " ");
  return fmtParam({ ...p, value: v } as Param);
}

/** The control for one slot's value, by slot type. Also used by the questions setup table. */
export function Answer({ p, slots, onChange }: { p: Param; slots?: Slots; onChange: (v: Value) => void }) {
  switch (p.type) {
    case "number":
      return (
        <span className="pv">
          <Num value={p.value} onChange={(v) => onChange(v ?? 0)} />
          {p.unit && <span className="muted small">{p.unit}</span>}
        </span>
      );
    case "choice":
      return <Select value={p.value} options={p.options} labels={p.optionLabels} onChange={(v) => onChange(v ?? p.options[0])} />;
    case "boolean":
      return (
        <div className="yesno" role="radiogroup">
          {[true, false].map((b) => (
            <label key={String(b)} className={`option inline ${p.value === b ? "on" : ""}`}>
              <input type="radio" checked={p.value === b} onChange={() => onChange(b)} />
              <span>{b ? "Yes" : "No"}</span>
            </label>
          ))}
        </div>
      );
    case "text":
      return <Text value={p.value} onChange={(v) => onChange(v ?? "")} optional={false} />;
    case "formula": {
      const choices = p.choices ?? [];
      const picked = choices.findIndex((c) => sameFormula(c.value, p.value));
      return (
        <div className="formula-answer">
          {choices.length > 0 && (
            <select value={picked < 0 ? "custom" : String(picked)} onChange={(e) => e.target.value !== "custom" && onChange(choices[Number(e.target.value)].value)}>
              {choices.map((c, i) => (
                <option key={i} value={i}>
                  {c.label}
                </option>
              ))}
              <option value="custom">Custom formula (edit below)</option>
            </select>
          )}
          <ExprInput value={p.value} onChange={(v) => onChange(v ?? "")} rows={2} slots={slots} />
          <span className="muted small">
            Result in {p.unit ?? "the item's unit"}
            {p.variables ? `. Uses: ${p.variables}` : ""}
          </span>
        </div>
      );
    }
  }
}
