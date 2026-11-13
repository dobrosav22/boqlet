"use client";

/**
 * Questions setup (Advanced), ported from the PoC's `QuestionSetup.tsx`: every part of a rule set's
 * questions as forms, so nothing about them needs the JSON tab. A question is a slot
 * (`RuleSet.params`); sections group them (`sections`).
 *
 * On a set that extends another, inherited questions keep the parent's wording; "Change the
 * question in this set" copies one here to reword it. Sections of the parent can be retitled and
 * new ones added (a patch's `sections` merge by id).
 */
import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import type { OurRuleType, Param, RuleSection, RuleSet } from "@ifc-boq/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isPatch, move, put, removeAt, renameChoiceOption, renameParam, replaceAt, slug, uniqueId } from "../shared/doc";
import { ExprInput, Field, LazyText, Num, RowList, Section, Select, Text, TextArea, ToggleChips, linkButton, matches, useFmtParam, type RowInfo } from "../shared/fields";
import { effectiveSections, questionStatus, type OwnParams, type QuestionStatus, type Slots } from "./model";
import { NavLink } from "./nav";
import { Answer } from "./questions-tab";
import { RemoveButton, UnitInput } from "./rule-parts";

const TYPES = ["number", "choice", "boolean", "text", "formula"] as const;
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

interface Props {
  doc: OurRuleType;
  onChange: (d: OurRuleType) => void;
  parent: RuleSet | null;
  slots: Slots;
  usage: Record<string, string[]>;
  ruleLabel: (id: string) => string;
  onOpenRule: (id: string) => void;
}

const BADGE_TONE: Partial<Record<QuestionStatus, NonNullable<RowInfo["badge"]>["tone"]>> = { inherited: "inherited", answered: "changed", redefined: "changed", new: "new" };

export function QuestionSetup({ doc, onChange, parent, slots, usage, ruleLabel, onOpenRule }: Props) {
  const t = useTranslations("ruleSetEditor.setup");
  const fmt = useFmtParam();
  const patch = isPatch(doc);
  const own = (doc.params ?? {}) as OwnParams;
  const sections = effectiveSections(doc, parent);
  const names = Object.keys(slots);
  const [sel, setSel] = useState<string | null>(names[0] ?? null);
  const [q, setQ] = useState("");
  const setOwn = (k: string, v: OwnParams[string] | undefined) => onChange({ ...doc, params: put(own, k, v) } as OurRuleType);

  const sectionOf = (k: string) => (sections.some((s) => s.id === slots[k]!.section) ? slots[k]!.section : undefined);
  const sectionTitle = (id?: string) => sections.find((s) => s.id === id)?.title ?? t("otherSettings");
  const order = [...sections.map((s) => s.id), undefined];
  const rows: RowInfo[] = names
    .filter((k) => matches(q, k, slots[k]!.label, slots[k]!.question))
    .sort((a, b) => order.indexOf(sectionOf(a)) - order.indexOf(sectionOf(b)))
    .map((k) => {
      const status = questionStatus(k, own, parent, patch);
      return {
        key: k,
        title: slots[k]!.question ?? slots[k]!.label ?? k,
        sub: t("rowSub", { type: t(`types.${slots[k]!.type}`), value: fmt(slots[k]) }),
        badge: BADGE_TONE[status] ? { text: t(`status.${status}`), tone: BADGE_TONE[status] } : undefined,
        section: sectionTitle(sectionOf(k)),
      };
    });

  const add = () => {
    const k = uniqueId("new_question", names);
    const section = (sel && slots[sel]?.section) || sections[0]?.id;
    setOwn(k, { type: "boolean", value: false, label: t("newLabel"), question: t("newQuestion"), ...(section ? { section } : {}) });
    setSel(k);
  };

  return (
    <div className="flex flex-col gap-4" data-testid="question-setup">
      <p className="max-w-[72ch] text-muted-foreground">{t("intro")}</p>
      <SectionsEditor doc={doc} onChange={onChange} parent={parent} slots={slots} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(16rem,1fr)_minmax(0,2fr)]">
        <RowList
          rows={rows}
          selected={sel}
          onSelect={setSel}
          filter={q}
          onFilter={setQ}
          tools={
            <Button type="button" variant="outline" size="sm" onClick={add} data-testid="add-question">
              {t("add")}
            </Button>
          }
        />
        <div className="min-w-0">
          {!sel || !slots[sel] ? (
            <p className="text-muted-foreground">{t("selectOne")}</p>
          ) : (
            <QuestionForm
              key={sel}
              name={sel}
              doc={doc}
              onChange={onChange}
              parent={parent}
              slots={slots}
              sections={sections}
              usage={usage[sel] ?? []}
              ruleLabel={ruleLabel}
              onOpenRule={onOpenRule}
              onSelect={setSel}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- one question */

/** Drop keys whose value is undefined (spread `keep` below). */
const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

function QuestionForm({ name, doc, onChange, parent, slots, sections, usage, ruleLabel, onOpenRule, onSelect }: {
  name: string;
  doc: OurRuleType;
  onChange: (d: OurRuleType) => void;
  parent: RuleSet | null;
  slots: Slots;
  sections: RuleSection[];
  usage: string[];
  ruleLabel: (id: string) => string;
  onOpenRule: (id: string) => void;
  onSelect: (k: string | null) => void;
}) {
  const t = useTranslations("ruleSetEditor.setup");
  const patch = isPatch(doc);
  const own = (doc.params ?? {}) as OwnParams;
  const p = slots[name]!;
  const status = questionStatus(name, own, parent, patch);
  const editable = status === "own" || status === "new" || status === "redefined";
  const [nameError, setNameError] = useState<string | null>(null);
  const setOwn = (v: OwnParams[string] | undefined) => onChange({ ...doc, params: put(own, name, v) } as OurRuleType);
  const set = (np: Param) => setOwn(np);
  const setValue = (v: Param["value"]) => {
    if (editable) return set({ ...p, value: v } as Param);
    const inherited = parent?.params[name];
    setOwn(inherited && JSON.stringify(inherited.value) === JSON.stringify(v) ? undefined : { value: v });
  };

  const rename = (raw: string) => {
    const to = raw.trim();
    if (to === name) return setNameError(null);
    if (!NAME.test(to)) return setNameError(t("nameInvalid"));
    if (slots[to]) return setNameError(t("nameTaken", { name: to }));
    setNameError(null);
    onChange(renameParam(doc, name, to));
    onSelect(to);
  };
  const changeType = (type: Param["type"]) => {
    const keep = { label: p.label, question: p.question, section: p.section, help: p.help, example: p.example, dependsOn: p.dependsOn };
    const blank: Record<Param["type"], Param> = {
      number: { ...keep, type: "number", value: 0 },
      choice: { ...keep, type: "choice", value: "option_1", options: ["option_1", "option_2"] },
      boolean: { ...keep, type: "boolean", value: false },
      text: { ...keep, type: "text", value: "" },
      formula: { ...keep, type: "formula", value: "", unit: "m2" },
    };
    set(clean(blank[type]));
  };
  const remove = () => {
    if (usage.length && !window.confirm(t("deleteConfirm", { question: p.question ?? p.label, items: usage.map(ruleLabel).join(", ") }))) return;
    setOwn(undefined);
    onSelect(null);
  };

  const dependable = Object.entries(slots).filter(([k, s]) => k !== name && (s.type === "boolean" || s.type === "choice"));

  return (
    <div className="flex flex-col gap-4" data-testid="question-form" data-slot={name}>
      <div className="flex flex-wrap items-center gap-2">
        {status === "inherited" || status === "answered" ? (
          <>
            <span className="text-muted-foreground">{t("wordedByParent", { parent: isPatch(doc) ? doc.extends : "" })}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => set({ ...p } as Param)}>
              {t("changeHere")}
            </Button>
          </>
        ) : status === "redefined" ? (
          <>
            <span className="text-muted-foreground">{t("changedHere")}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => setOwn(undefined)}>
              {t("backToInherited")}
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" size="sm" className="text-error" onClick={remove} data-testid="delete-question">
            {t("delete")}
          </Button>
        )}
      </div>

      <Section title={t("answer")}>
        <Field label={patch ? t("answerHere") : t("defaultAnswer")} wide group>
          <Answer p={p} slots={slots} onChange={setValue} />
        </Field>
      </Section>

      <fieldset className="flex min-w-0 flex-col gap-4 disabled:opacity-80" disabled={!editable}>
        <Section title={t("question")}>
          <Field label={t("question")} wide>
            <Text value={p.question} onChange={(v) => set(put(p, "question", v))} placeholder={t("questionPlaceholder")} />
          </Field>
          <Field label={t("shortName")} hint={t("shortNameHint")}>
            <Text value={p.label} onChange={(v) => set({ ...p, label: v ?? "" })} optional={false} />
          </Field>
          <Field label={t("section")}>
            <Select value={p.section} options={sections.map((s) => s.id)} labels={Object.fromEntries(sections.map((s) => [s.id, s.title]))} empty={t("otherSettings")} onChange={(v) => set(put(p, "section", v))} />
          </Field>
          <Field label={t("kind")}>
            <Select value={p.type} options={TYPES} labels={(o) => t(`types.${o}`)} onChange={(v) => v && v !== p.type && changeType(v)} />
          </Field>
          <Field label={t("storedAs")} group hint={status === "redefined" ? t("storedAsInherited") : (nameError ?? t("storedAsHint"))}>
            <LazyText mono value={name} onCommit={rename} aria-label={t("storedAs")} />
          </Field>
          <Field label={t("help")} wide>
            <TextArea value={p.help} onChange={(v) => set(put(p, "help", v))} rows={2} />
          </Field>
          <Field label={t("example")} wide hint={t("exampleHint")}>
            <TextArea value={p.example} onChange={(v) => set(put(p, "example", v))} rows={2} />
          </Field>
        </Section>

        <TypeSettings
          p={p}
          set={set}
          slots={slots}
          onRenameOption={(np, from, to) => onChange(renameChoiceOption({ ...doc, params: put(own, name, np) } as OurRuleType, parent, name, from, to))}
        />

        <Section title={t("onlyAskWhen")} hint={t("onlyAskWhenHint")}>
          <Field label={t("dependsOn")}>
            <Select
              value={p.dependsOn?.param}
              options={dependable.map(([k]) => k)}
              labels={Object.fromEntries(dependable.map(([k, s]) => [k, s.question ?? s.label ?? k]))}
              empty={t("alwaysAsked")}
              onChange={(k) => set(put(p, "dependsOn", k ? { param: k, values: slots[k]!.type === "boolean" ? [true] : [(slots[k] as { value: string }).value] } : undefined))}
            />
          </Field>
          {p.dependsOn && slots[p.dependsOn.param] && <DependsOnValues p={p} on={slots[p.dependsOn.param]!} set={set} />}
        </Section>
      </fieldset>

      <Section title={t("usedBy")}>
        <div className="col-span-full">
          {usage.length === 0 ? (
            <span className="text-muted-foreground">{t("notUsed")}</span>
          ) : (
            usage.map((id, i) => (
              <span key={id}>
                {i > 0 && t("listSeparator")}
                <NavLink onClick={() => onOpenRule(id)}>{ruleLabel(id)}</NavLink>
              </span>
            ))
          )}
        </div>
      </Section>
    </div>
  );
}

function DependsOnValues({ p, on, set }: { p: Param; on: Param; set: (p: Param) => void }) {
  const t = useTranslations("ruleSetEditor.setup");
  const d = p.dependsOn!;
  const options = on.type === "boolean" ? ["yes", "no"] : on.type === "choice" ? [...on.options] : [];
  const selected = d.values.map((v) => (v === true ? "yes" : v === false ? "no" : String(v)));
  const labels = on.type === "choice" ? on.optionLabels : { yes: t("yes"), no: t("no") };
  return (
    <Field label={t("forAnswers")} group wide>
      <ToggleChips options={options} selected={selected} labels={labels} onChange={(l) => set({ ...p, dependsOn: { ...d, values: l.map((v) => (on.type === "boolean" ? v === "yes" : v)) } } as Param)} />
    </Field>
  );
}

function TypeSettings({ p, set, slots, onRenameOption }: {
  p: Param;
  set: (p: Param) => void;
  slots: Slots;
  /** The slot with an answer renamed; the caller renames it where items and follow-ups use it. */
  onRenameOption: (p: Param, from: string, to: string) => void;
}) {
  const t = useTranslations("ruleSetEditor.setup");
  if (p.type === "number")
    return (
      <Section title={t("number")}>
        <Field label={t("unit")}>
          <UnitInput value={p.unit} onChange={(u) => set(put(p, "unit", u))} />
        </Field>
        <Field label={t("min")}>
          <Num value={p.min} onChange={(v) => set(put(p, "min", v))} placeholder={t("noLimit")} />
        </Field>
        <Field label={t("max")}>
          <Num value={p.max} onChange={(v) => set(put(p, "max", v))} placeholder={t("noLimit")} />
        </Field>
      </Section>
    );
  if (p.type === "choice") {
    const opts = [...p.options];
    const setOptions = (next: string[], labels = p.optionLabels) => {
      const kept = labels && Object.fromEntries(Object.entries(labels).filter(([k]) => next.includes(k)));
      set(put({ ...p, options: next, value: next.includes(p.value) ? p.value : (next[0] ?? "") }, "optionLabels", kept && Object.keys(kept).length ? kept : undefined));
    };
    return (
      <Section title={t("answers")} hint={t("answersHint")}>
        <div className="col-span-full flex flex-col gap-2" data-testid="choice-options">
          {opts.map((o, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
              <LazyText
                mono
                value={o}
                aria-label={t("optionName")}
                onCommit={(n) => {
                  const nn = n.trim();
                  if (!nn || nn === o || opts.includes(nn)) return;
                  const labels = p.optionLabels && Object.fromEntries(Object.entries(p.optionLabels).map(([k, v]) => [k === o ? nn : k, v]));
                  onRenameOption(put({ ...p, options: replaceAt(opts, i, nn), value: p.value === o ? nn : p.value }, "optionLabels", labels), o, nn);
                }}
              />
              <Text
                value={p.optionLabels?.[o]}
                placeholder={o.replace(/_/g, " ")}
                aria-label={t("optionText")}
                onChange={(v) => {
                  const labels = put({ ...(p.optionLabels ?? {}) }, o, v);
                  set(put(p, "optionLabels", Object.keys(labels).length ? labels : undefined));
                }}
              />
              <span className="flex items-center">
                <MoveUp label={t("moveUp")} disabled={i === 0} onClick={() => setOptions(move(opts, i, -1))} />
                <RemoveButton label={t("removeOption", { name: o })} disabled={opts.length <= 1} onClick={() => setOptions(removeAt(opts, i))} />
              </span>
            </div>
          ))}
          <button type="button" className={cn(linkButton, "self-start")} onClick={() => setOptions([...opts, uniqueId(`option_${opts.length + 1}`, opts)])}>
            {t("addAnswer")}
          </button>
          <p className="text-muted-foreground">{t("answersNote")}</p>
        </div>
      </Section>
    );
  }
  if (p.type === "formula") {
    const choices = p.choices ?? [];
    const setChoices = (c: { label: string; value: string }[]) => set(put(p, "choices", c.length ? c : undefined));
    return (
      <Section title={t("formula")} hint={t("formulaHint")}>
        <Field label={t("resultUnit")}>
          <UnitInput value={p.unit} onChange={(u) => set(put(p, "unit", u))} />
        </Field>
        <Field label={t("variables")} wide hint={t("variablesHint")}>
          <Text value={p.variables} onChange={(v) => set(put(p, "variables", v))} />
        </Field>
        <div className="col-span-full flex flex-col gap-2">
          <span className="label-caps text-muted-foreground">{t("readyMade")}</span>
          {choices.map((c, i) => (
            <div key={i} className="flex flex-col gap-1 border-l-2 border-border pl-3">
              <div className="flex items-center gap-1">
                <Text value={c.label} onChange={(v) => setChoices(replaceAt(choices, i, { ...c, label: v ?? "" }))} placeholder={t("choicePlaceholder")} optional={false} aria-label={t("choiceName")} />
                <MoveUp label={t("moveUp")} disabled={i === 0} onClick={() => setChoices(move(choices, i, -1))} />
                <RemoveButton label={t("removeOption", { name: c.label })} onClick={() => setChoices(removeAt(choices, i))} />
              </div>
              <ExprInput value={c.value} onChange={(v) => setChoices(replaceAt(choices, i, { ...c, value: v ?? "" }))} slots={slots} />
            </div>
          ))}
          <button type="button" className={cn(linkButton, "self-start")} onClick={() => setChoices([...choices, { label: t("newFormula"), value: p.value }])}>
            {t("addReadyMade")}
          </button>
        </div>
      </Section>
    );
  }
  return null;
}

function MoveUp({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="h-8 shrink-0 px-1 text-muted-foreground hover:text-foreground disabled:opacity-40" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <ArrowUp className="size-3.5" aria-hidden />
    </button>
  );
}

/* ---------------------------------------------------------------- sections */

function SectionsEditor({ doc, onChange, parent, slots }: { doc: OurRuleType; onChange: (d: OurRuleType) => void; parent: RuleSet | null; slots: Slots }) {
  const t = useTranslations("ruleSetEditor.setup");
  const patch = isPatch(doc);
  const mine = doc.sections ?? [];
  const shown = effectiveSections(doc, parent);
  const inherited = new Set((parent?.sections ?? []).map((s) => s.id));
  const setMine = (l: RuleSection[]) => onChange(put(doc, "sections", l.length ? l : undefined) as OurRuleType);
  const count = (id: string) => Object.values(slots).filter((p) => p.section === id).length;

  const update = (s: RuleSection) => {
    const i = mine.findIndex((x) => x.id === s.id);
    setMine(i < 0 ? [...mine, s] : replaceAt(mine, i, s));
  };
  const add = () => setMine([...mine, { id: uniqueId("new-section", shown.map((s) => s.id)), title: t("newSection") }]);
  const rename = (from: string, to: string) => {
    const id = slug(to);
    if (!id || id === from || shown.some((s) => s.id === id)) return;
    const params = Object.fromEntries(Object.entries(doc.params ?? {}).map(([k, p]) => [k, "type" in p && p.section === from ? { ...p, section: id } : p]));
    onChange({ ...doc, params, sections: mine.map((s) => (s.id === from ? { ...s, id } : s)) } as OurRuleType);
  };

  return (
    <details className="rounded-[var(--radius)] border border-border p-3" data-testid="sections-editor">
      <summary className="cursor-pointer">{t("sections", { n: shown.length })}</summary>
      <div className="mt-3 flex flex-col gap-2">
        <div className="label-caps grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,1fr)_4rem] gap-2 text-muted-foreground">
          <span>{t("sectionTitle")}</span>
          <span>{t("sectionIntro")}</span>
          <span>{t("storedAs")}</span>
          <span />
        </div>
        {shown.map((s) => {
          const fromParent = patch && inherited.has(s.id);
          const i = mine.findIndex((x) => x.id === s.id);
          return (
            <div key={s.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,1fr)_4rem] items-center gap-2">
              <Text value={s.title} onChange={(v) => update({ ...s, title: v ?? "" })} optional={false} aria-label={t("sectionTitle")} />
              <Text value={s.intro} onChange={(v) => update(put(s, "intro", v))} aria-label={t("sectionIntro")} />
              {fromParent ? <code className="truncate">{s.id}</code> : <LazyText mono value={s.id} onCommit={(v) => rename(s.id, v)} aria-label={t("storedAs")} />}
              <span className="flex items-center">
                {!patch && <MoveUp label={t("moveUp")} disabled={i <= 0} onClick={() => setMine(move(mine, i, -1))} />}
                {fromParent ? (
                  i >= 0 && (
                    <button type="button" className={linkButton} onClick={() => setMine(removeAt(mine, i))} title={t("resetTitle")}>
                      {t("reset")}
                    </button>
                  )
                ) : (
                  <RemoveButton
                    label={t("removeSection", { title: s.title })}
                    onClick={() => (count(s.id) === 0 || window.confirm(t("removeSectionConfirm", { n: count(s.id), title: s.title }))) && setMine(removeAt(mine, i))}
                  />
                )}
              </span>
            </div>
          );
        })}
        <button type="button" className={cn(linkButton, "self-start")} onClick={add}>
          {t("addSection")}
        </button>
        {patch && <p className="text-muted-foreground">{t("sectionsPatchNote")}</p>}
      </div>
    </details>
  );
}
