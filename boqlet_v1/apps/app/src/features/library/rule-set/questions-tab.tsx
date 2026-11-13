"use client";

/**
 * The Settings tab, ported from the PoC's `QuestionsTab.tsx`: a rule set's slots asked as plain
 * questions, grouped by section.
 *
 * On a set that extends another (a company's standard on top of the master template), every
 * question shows the inherited default and "your answer"; only answers that differ are stored.
 * Follow-up questions sit under the question they depend on and are hidden while they don't
 * apply. The rules behind each question stay one click away ("Used by …"), so nothing is hidden.
 *
 * `focus` (the page's `?question=<slot>`, F10 / FE-013) scrolls one question into view and marks it.
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { OurRuleType, Param, RuleSection, RuleSet } from "@ifc-boq/types";
import { cn } from "@/lib/utils";
import { isPatch, put } from "../shared/doc";
import { ExprInput, Num, Select, Text, inputClass, linkButton, useFmtParam } from "../shared/fields";
import { sameFormula } from "../lib/readable";
import { answerParams, applies, bySection, effectiveSections, followUps, orderQuestions, sameValue, type OwnParams, type ScopeEntry, type Slots } from "./model";
import { NavLink, Tag } from "./nav";

type Value = Param["value"];

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
  /** The question to show and mark (`?question=<slot>`). */
  focus?: string | null;
}

/** The id of a question's card, for jumps. */
export const questionDomId = (slot: string) => `slot-${slot}`;

export function QuestionsTab({ doc, onChange, parent, slots, usage, scope, ruleLabel, onOpenRule, onOpenSetup, focus }: Props) {
  const t = useTranslations("ruleSetEditor.questions");
  const patch = isPatch(doc);
  const own = (doc.params ?? {}) as OwnParams;
  const sections: RuleSection[] = effectiveSections(doc, parent);
  const fmt = useFmtParam();
  const [onlyChanged, setOnlyChanged] = useState(false);

  const names = Object.keys(slots);
  const sectionOf = bySection(slots, sections);
  const groups: RuleSection[] = [...sections, { id: "_other", title: t("otherSettings"), intro: t("otherSettingsIntro") }].filter((s) => sectionOf.has(s.id));

  /** The value this set would use if it did not answer (patches: the parent's). */
  const defaultOf = (n: string): Value | undefined => (patch ? parent?.params[n]?.value : undefined);
  const answered = (n: string) => patch && n in own && defaultOf(n) !== undefined && !sameValue(slots[n]!.value, defaultOf(n));
  const changedCount = names.filter(answered).length;

  const setValue = (n: string, v: Value) => onChange({ ...doc, params: answerParams(own, slots, n, v, patch, defaultOf(n)) } as OurRuleType);
  const resetToDefault = (n: string) => onChange({ ...doc, params: put(own, n, undefined) } as OurRuleType);

  const jump = (slot: string) => document.getElementById(questionDomId(slot))?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  // The deep link: bring the question into view once it is on the page (scrolling is not state).
  const focusShown = !!focus && !!slots[focus];
  useEffect(() => {
    if (focus && focusShown) document.getElementById(questionDomId(focus))?.scrollIntoView?.({ block: "center" });
  }, [focus, focusShown]);

  if (!patch && sections.length === 0 && names.length === 0) return <p className="text-muted-foreground">{t("none")}</p>;

  const included = scope.filter((s) => s.on);
  const excluded = scope.filter((s) => !s.on);
  const links = (list: ScopeEntry[]) =>
    list.map((s, i) => (
      <span key={s.label}>
        {i > 0 && t("listSeparator")}
        <NavLink onClick={() => jump(s.slot)}>{s.label}</NavLink>
      </span>
    ));

  return (
    <div className="flex flex-col gap-6" data-testid="questions-tab">
      <div className="flex flex-col gap-3">
        <p className="max-w-[72ch] text-prose">
          {patch
            ? t.rich(parent?.name ? "introPatchNamed" : "introPatch", { id: doc.extends, name: parent?.name ?? "", b: (c) => <b>{c}</b> })
            : t("introStandalone")}
        </p>
        {scope.length > 0 && (
          <div className="flex flex-col gap-1" data-testid="scope-summary">
            <p>
              <b>{t("inThisBoq")}</b> {included.length ? links(included) : <span className="text-muted-foreground">{t("noneOptional")}</span>}
            </p>
            {excluded.length > 0 && (
              <p className="text-muted-foreground">
                <b>{t("notInIt")}</b> {links(excluded)}
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {groups.map((g) => {
            const mine = (sectionOf.get(g.id) ?? []).filter(answered).length;
            return (
              <a key={g.id} href={`#q-${g.id}`} className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-border px-2 py-0.5 hover:bg-muted">
                {g.title}
                {patch && mine > 0 && <span className="text-link tabular-nums">{mine}</span>}
              </a>
            );
          })}
          {patch && (
            <label className="ml-auto inline-flex items-center gap-2">
              <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} data-testid="only-mine" />
              <span>{t("onlyMine", { n: changedCount, total: names.length })}</span>
            </label>
          )}
        </div>
      </div>

      {groups.map((g) => {
        const all = sectionOf.get(g.id) ?? [];
        const list = orderQuestions(slots, all).filter(({ n }) => n === focus || (onlyChanged ? answered(n) : applies(slots, n)));
        if (list.length === 0) return null;
        return (
          <section key={g.id} id={`q-${g.id}`} className="flex flex-col gap-2" data-testid="question-section">
            <h2 className="label-caps border-b border-border pb-1">{g.title}</h2>
            {g.intro && <p className="max-w-[72ch] text-muted-foreground">{g.intro}</p>}
            {list.map(({ n, depth }) => {
              const p = slots[n]!;
              const dflt = defaultOf(n);
              const mine = answered(n);
              const hidden = followUps(slots, n, names).filter((m) => !applies(slots, m)).length;
              const focused = n === focus;
              return (
                <div
                  key={n}
                  id={questionDomId(n)}
                  data-testid="question"
                  data-slot={n}
                  data-mine={mine ? "true" : undefined}
                  data-focused={focused ? "true" : undefined}
                  className={cn(
                    "grid grid-cols-1 gap-3 rounded-[var(--radius)] border border-border p-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
                    mine && "border-l-2 border-l-link",
                    focused && "border-l-2 border-l-link bg-selection",
                  )}
                  style={depth ? { marginLeft: 24 * depth } : undefined}
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="text-prose font-medium" title={t("storedAs", { name: n })}>
                      {p.question ?? p.label}
                    </div>
                    {p.help && <p className="max-w-[72ch] text-muted-foreground">{p.help}</p>}
                    {p.example && (
                      <details>
                        <summary className="cursor-pointer text-muted-foreground">{t("example")}</summary>
                        <p className="max-w-[72ch] text-muted-foreground">{p.example}</p>
                      </details>
                    )}
                    <div className="flex flex-wrap gap-x-4 text-muted-foreground">
                      {hidden > 0 && !onlyChanged && <span>{t("followUps", { n: hidden })}</span>}
                      {(usage[n] ?? []).length > 0 ? (
                        <span data-testid="used-by">
                          {t("usedBy")}{" "}
                          {usage[n]!.map((id, i) => (
                            <span key={id}>
                              {i > 0 && t("listSeparator")}
                              <NavLink onClick={() => onOpenRule(id)} title={t("openItem")} data-testid="used-by-link">
                                {ruleLabel(id)}
                              </NavLink>
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span>{t("notUsed")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1" data-testid="answer">
                    <Answer p={p} slots={slots} onChange={(v) => setValue(n, v)} />
                    {patch && dflt !== undefined && (
                      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                        {mine ? (
                          <>
                            <Tag tone="changed">{t("yourAnswer")}</Tag>
                            <span>{t("defaultIs", { value: fmtAnswer(fmt, p, dflt) })}</span>
                            <button type="button" className={linkButton} onClick={() => resetToDefault(n)} data-testid="use-default">
                              {t("useDefault")}
                            </button>
                          </>
                        ) : (
                          <span>{t("default")}</span>
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
      <p className="text-muted-foreground">
        {t.rich("missing", {
          add: (c) => <NavLink onClick={onOpenSetup}>{c}</NavLink>,
        })}
      </p>
    </div>
  );
}

export function fmtAnswer(fmt: (p: Param | undefined) => string, p: Param, v: Value): string {
  if (p.type === "choice" && typeof v === "string") return p.optionLabels?.[v] ?? v.replace(/_/g, " ");
  return fmt({ ...p, value: v } as Param);
}

/** The control for one slot's value, by slot type. Also used by the questions setup. */
export function Answer({ p, slots, onChange }: { p: Param; slots?: Slots; onChange: (v: Value) => void }) {
  const t = useTranslations("ruleSetEditor.questions");
  const label = p.question ?? p.label;
  switch (p.type) {
    case "number":
      return (
        <span className="flex items-center gap-2">
          <Num value={p.value} onChange={(v) => onChange(v ?? 0)} aria-label={label} />
          {p.unit && <span className="text-muted-foreground">{p.unit}</span>}
        </span>
      );
    case "choice":
      return <Select value={p.value} options={p.options} labels={p.optionLabels} onChange={(v) => onChange(v ?? p.options[0]!)} aria-label={label} />;
    case "boolean":
      return (
        <div className="flex gap-1" role="radiogroup" aria-label={label}>
          {[true, false].map((b) => (
            <label key={String(b)} className={cn("inline-flex h-8 cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-border px-3", p.value === b && "border-foreground bg-muted")}>
              <input type="radio" checked={p.value === b} onChange={() => onChange(b)} />
              <span>{b ? t("yes") : t("no")}</span>
            </label>
          ))}
        </div>
      );
    case "text":
      return <Text value={p.value} onChange={(v) => onChange(v ?? "")} optional={false} aria-label={label} />;
    case "formula": {
      const choices = p.choices ?? [];
      const picked = choices.findIndex((c) => sameFormula(c.value, p.value));
      return (
        <div className="flex flex-col gap-1">
          {choices.length > 0 && (
            <select className={inputClass} value={picked < 0 ? "custom" : String(picked)} aria-label={label} onChange={(e) => e.target.value !== "custom" && onChange(choices[Number(e.target.value)]!.value)}>
              {choices.map((c, i) => (
                <option key={i} value={i}>
                  {c.label}
                </option>
              ))}
              <option value="custom">{t("customFormula")}</option>
            </select>
          )}
          <ExprInput value={p.value} onChange={(v) => onChange(v ?? "")} rows={2} slots={slots} aria-label={label} />
          <span className="text-muted-foreground">{p.variables ? t("resultInUses", { unit: p.unit ?? t("itemUnit"), uses: p.variables }) : t("resultIn", { unit: p.unit ?? t("itemUnit") })}</span>
        </div>
      );
    }
  }
}
