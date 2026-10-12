/**
 * The settings questionnaire: a rule set's slots asked as plain questions, grouped by section.
 *
 * On a set that extends another (a company's standard on top of the master template), every
 * question shows the inherited default and "your answer"; only answers that differ are stored.
 * The rules behind each question stay one click away ("Used by …"), so nothing is hidden.
 */
import { useState } from "react";
import type { OurRuleType, Param, RuleSection, RuleSet } from "@ifc-boq/types";
import { ExprInput, Num, Select, Text, fmtParam } from "./fields";
import { isPatch, put } from "./store";

type Slots = Record<string, Param>;
type Value = Param["value"];

interface Props {
  doc: OurRuleType;
  onChange: (d: OurRuleType) => void;
  parent: RuleSet | null;
  slots: Slots;
  usage: Record<string, string[]>;
  ruleLabel: (id: string) => string;
  onOpenRule: (id: string) => void;
  onOpenSlots: () => void;
}

export function QuestionsTab({ doc, onChange, parent, slots, usage, ruleLabel, onOpenRule, onOpenSlots }: Props) {
  const patch = isPatch(doc);
  const own = (doc.params ?? {}) as Record<string, Param | { value: Value }>;
  const sections: RuleSection[] = (patch ? parent?.sections : (doc as RuleSet).sections) ?? [];
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

  const applies = (p: Param) => !p.dependsOn || p.dependsOn.values.some((v) => JSON.stringify(v) === JSON.stringify(slots[p.dependsOn!.param]?.value));
  const whenText = (p: Param) => {
    const d = p.dependsOn!;
    const on = slots[d.param];
    const label = (v: string | number | boolean) => (on?.type === "choice" && typeof v === "string" ? on.optionLabels?.[v] ?? v : v === true ? "yes" : v === false ? "no" : String(v));
    return `Applies when “${on?.question ?? on?.label ?? d.param}” is ${d.values.map(label).join(" or ")}.`;
  };

  if (!patch && sections.length === 0 && names.length === 0)
    return <p className="muted">This rule set has no slots yet. Add them in the Slots tab, with a section and a question, and they appear here.</p>;

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
        const list = (bySection.get(g.id) ?? []).filter((n) => !onlyChanged || answered(n));
        if (list.length === 0) return null;
        return (
          <section key={g.id} id={`q-${g.id}`} className="q-section">
            <h2>{g.title}</h2>
            {g.intro && <p className="hint">{g.intro}</p>}
            {list.map((n) => {
              const p = slots[n];
              const dflt = defaultOf(n);
              const mine = answered(n);
              const on = applies(p);
              return (
                <div key={n} className={`qcard ${mine ? "mine" : ""} ${on ? "" : "dim"}`}>
                  <div className="qcard-text">
                    <div className="qcard-q">{p.question ?? p.label}</div>
                    {p.help && <p className="qcard-help">{p.help}</p>}
                    {!on && <p className="qcard-help">{whenText(p)}</p>}
                    {p.example && (
                      <details>
                        <summary>Example</summary>
                        <p className="qcard-help">{p.example}</p>
                      </details>
                    )}
                    <div className="qcard-meta">
                      <code title="Slot name">{n}</code>
                      {(usage[n] ?? []).length > 0 ? (
                        <span>
                          Used by{" "}
                          {usage[n].map((id, i) => (
                            <span key={id}>
                              {i > 0 && ", "}
                              <button type="button" className="link" onClick={() => onOpenRule(id)} title="Open the rule that uses this answer">
                                {ruleLabel(id)}
                              </button>
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span>Not used by any rule yet</span>
                      )}
                    </div>
                  </div>
                  <div className="qcard-answer">
                    <Answer p={p} onChange={(v) => setValue(n, v)} />
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
        <button type="button" className="link small" onClick={onOpenSlots}>
          Add a slot
        </button>{" "}
        and point a rule at it, or change the rule itself in Item rules / Derived.
      </p>
    </div>
  );
}

function fmtAnswer(p: Param, v: Value): string {
  if (p.type === "choice" && typeof v === "string") return p.optionLabels?.[v] ?? v.replace(/_/g, " ");
  if (p.type === "formula") return String(v) || "(empty)";
  return fmtParam({ ...p, value: v } as Param);
}

/** The control for one slot's value, by slot type. Also used by the Slots table. */
export function Answer({ p, onChange }: { p: Param; onChange: (v: Value) => void }) {
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
    case "formula":
      return (
        <div className="formula-answer">
          <ExprInput value={p.value} onChange={(v) => onChange(v ?? "")} rows={2} />
          <span className="muted small">
            Result in {p.unit ?? "the rule's unit"}
            {p.variables ? `. ${p.variables}` : ""}
          </span>
        </div>
      );
  }
}
