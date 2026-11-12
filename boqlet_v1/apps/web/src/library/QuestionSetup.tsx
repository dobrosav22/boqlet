/**
 * Questions setup (Advanced): every part of a rule set's questions as forms, so nothing about them
 * needs the JSON tab. A question is a slot (`RuleSet.params`); sections group them (`sections`).
 *
 * On a set that extends another, inherited questions keep the parent's wording; "Change the
 * question in this set" copies one here to reword it. Sections of the parent can be retitled and
 * new ones added (a patch's `sections` merge by id).
 */
import { useState } from "react";
import type { OurRuleType, Param, RuleSection, RuleSet } from "@ifc-boq/types";
import { ExprInput, Field, LazyText, Num, RowList, Section, Select, Text, TextArea, ToggleChips, fmtParam, matches, type RowInfo } from "./fields";
import { UnitInput } from "./ruleParts";
import { Answer } from "./QuestionsTab";
import { isPatch, move, put, removeAt, renameChoiceOption, renameParam, replaceAt, slug, uniqueId } from "./store";

type Slots = Record<string, Param>;
type Own = Record<string, Param | { value: Param["value"] }>;

const TYPES = ["number", "choice", "boolean", "text", "formula"] as const;
const TYPE_LABEL: Record<Param["type"], string> = {
  number: "Number",
  choice: "Choice from a list",
  boolean: "Yes / no",
  text: "Text",
  formula: "Formula",
};
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

export function QuestionSetup({ doc, onChange, parent, slots, usage, ruleLabel, onOpenRule }: Props) {
  const patch = isPatch(doc);
  const own = (doc.params ?? {}) as Own;
  const sections = effectiveSections(doc, parent);
  const names = Object.keys(slots);
  const [sel, setSel] = useState<string | null>(names[0] ?? null);
  const [q, setQ] = useState("");
  const setOwn = (k: string, v: Own[string] | undefined) => onChange({ ...doc, params: put(own, k, v) } as OurRuleType);

  const sectionTitle = (id?: string) => sections.find((s) => s.id === id)?.title ?? "Other settings";
  const order = [...sections.map((s) => s.id), undefined];
  const rows: RowInfo[] = names
    .filter((k) => matches(q, k, slots[k].label, slots[k].question))
    .sort((a, b) => order.indexOf(sections.some((s) => s.id === slots[a].section) ? slots[a].section : undefined) - order.indexOf(sections.some((s) => s.id === slots[b].section) ? slots[b].section : undefined))
    .map((k) => ({
      key: k,
      title: slots[k].question ?? slots[k].label ?? k,
      sub: `${TYPE_LABEL[slots[k].type]} · now ${fmtParam(slots[k])}`,
      badge: statusBadge(statusOf(k, own, parent, patch)),
      section: sectionTitle(slots[k].section),
    }));

  const add = () => {
    const k = uniqueId("new_question", names);
    const section = (sel && slots[sel]?.section) || sections[0]?.id;
    setOwn(k, { type: "boolean", value: false, label: "New question", question: "New question?", ...(section ? { section } : {}) });
    setSel(k);
  };

  return (
    <div>
      <p className="hint">
        Set up the questions of the Settings tab: wording, type, answers, follow-ups, and which section they are in. Items use a question's answer through the{" "}
        <span className="vf-toggle on static">slot</span> button on a field.
      </p>
      <SectionsEditor doc={doc} onChange={onChange} parent={parent} slots={slots} />
      <div className="ld">
        <RowList
          rows={rows}
          selected={sel}
          onSelect={setSel}
          filter={q}
          onFilter={setQ}
          tools={
            <button type="button" className="ghost small-btn" onClick={add}>
              + New question
            </button>
          }
        />
        <div className="ld-detail">
          {!sel || !slots[sel] ? (
            <p className="muted">Select a question on the left, or add one.</p>
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

type Status = "own" | "inherited" | "answered" | "redefined" | "new";
function statusOf(k: string, own: Own, parent: RuleSet | null, patch: boolean): Status {
  const mine = own[k];
  if (!patch) return "own";
  if (mine && "type" in mine) return parent?.params[k] ? "redefined" : "new";
  return mine ? "answered" : "inherited";
}
function statusBadge(s: Status): RowInfo["badge"] {
  return s === "inherited"
    ? { text: "inherited", tone: "inherited" }
    : s === "answered"
      ? { text: "answer changed here", tone: "changed" }
      : s === "redefined"
        ? { text: "changed here", tone: "changed" }
        : s === "new"
          ? { text: "new here", tone: "new" }
          : undefined;
}

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
  const patch = isPatch(doc);
  const own = (doc.params ?? {}) as Own;
  const p = slots[name];
  const status = statusOf(name, own, parent, patch);
  const editable = status === "own" || status === "new" || status === "redefined";
  const [nameError, setNameError] = useState<string | null>(null);
  const setOwn = (v: Own[string] | undefined) => onChange({ ...doc, params: put(own, name, v) } as OurRuleType);
  const set = (np: Param) => setOwn(np);
  const setValue = (v: Param["value"]) => {
    if (editable) return set({ ...p, value: v } as Param);
    const inherited = parent?.params[name];
    setOwn(inherited && JSON.stringify(inherited.value) === JSON.stringify(v) ? undefined : { value: v });
  };

  const rename = (to: string) => {
    to = to.trim();
    if (to === name) return setNameError(null);
    if (!NAME.test(to)) return setNameError("Letters, digits and _ only, not starting with a digit.");
    if (slots[to]) return setNameError(`“${to}” is already a question.`);
    setNameError(null);
    onChange(renameParam(doc, name, to));
    onSelect(to);
  };
  const changeType = (t: Param["type"]) => {
    const keep = { label: p.label, question: p.question, section: p.section, help: p.help, example: p.example, dependsOn: p.dependsOn };
    const blank: Record<Param["type"], Param> = {
      number: { ...keep, type: "number", value: 0 },
      choice: { ...keep, type: "choice", value: "option_1", options: ["option_1", "option_2"] },
      boolean: { ...keep, type: "boolean", value: false },
      text: { ...keep, type: "text", value: "" },
      formula: { ...keep, type: "formula", value: "", unit: "m2" },
    };
    set(clean(blank[t]));
  };
  const remove = () => {
    if (usage.length && !window.confirm(`“${p.question ?? p.label}” is used by ${usage.map(ruleLabel).join(", ")}. Those items will report a missing parameter. Delete anyway?`)) return;
    setOwn(undefined);
    onSelect(null);
  };

  const dependable = Object.entries(slots).filter(([k, s]) => k !== name && (s.type === "boolean" || s.type === "choice"));

  return (
    <div className="form">
      <div className="ld-actions">
        {status === "inherited" || status === "answered" ? (
          <>
            <span className="muted small">Worded by the parent ({isPatch(doc) ? doc.extends : ""}); only the answer can change here.</span>
            <button type="button" className="ghost small-btn" onClick={() => set({ ...p } as Param)}>
              Change the question in this set
            </button>
          </>
        ) : status === "redefined" ? (
          <>
            <span className="muted small">Changed in this set; replaces the parent's version.</span>
            <button type="button" className="ghost small-btn" onClick={() => setOwn(undefined)}>
              Back to inherited
            </button>
          </>
        ) : (
          <button type="button" className="ghost small-btn danger" onClick={remove}>
            Delete question
          </button>
        )}
      </div>

      <Section title="Answer">
        <Field label={patch ? "Answer in this set" : "Default answer"} wide group>
          <Answer p={p} slots={slots} onChange={setValue} />
        </Field>
      </Section>

      <fieldset className="ro" disabled={!editable}>
        <Section title="Question">
          <Field label="Question" wide>
            <Text value={p.question} onChange={(v) => set(put(p, "question", v))} placeholder="As the rulebook would answer it" />
          </Field>
          <Field label="Short name" hint="Shown in tables, in formulas ([Short name]) and next to fields that use it.">
            <Text value={p.label} onChange={(v) => set({ ...p, label: v ?? "" })} optional={false} />
          </Field>
          <Field label="Section">
            <Select value={p.section} options={sections.map((s) => s.id)} labels={Object.fromEntries(sections.map((s) => [s.id, s.title]))} empty="Other settings" onChange={(v) => set(put(p, "section", v))} />
          </Field>
          <Field label="Kind of answer">
            <Select value={p.type} options={TYPES} labels={TYPE_LABEL} onChange={(t) => t && t !== p.type && changeType(t)} />
          </Field>
          <Field label="Stored as" group hint={status === "redefined" ? "Inherited name; it cannot change in this set." : nameError ?? "Renaming updates every item and formula in this set that uses it."}>
            <LazyText mono value={name} onCommit={rename} />
          </Field>
          <Field label="Help" wide>
            <TextArea value={p.help} onChange={(v) => set(put(p, "help", v))} rows={2} />
          </Field>
          <Field label="Example" wide hint="A worked example, shown folded under the question.">
            <TextArea value={p.example} onChange={(v) => set(put(p, "example", v))} rows={2} />
          </Field>
        </Section>

        <TypeSettings
          p={p}
          set={set}
          slots={slots}
          onRenameOption={(np, from, to) => onChange(renameChoiceOption({ ...doc, params: put(own, name, np) } as OurRuleType, parent, name, from, to))}
        />

        <Section title="Only ask when" hint="A follow-up question: shown under the question it depends on, and only for these answers.">
          <Field label="Depends on">
            <Select
              value={p.dependsOn?.param}
              options={dependable.map(([k]) => k)}
              labels={Object.fromEntries(dependable.map(([k, s]) => [k, s.question ?? s.label ?? k]))}
              empty="(always asked)"
              onChange={(k) => set(put(p, "dependsOn", k ? { param: k, values: slots[k].type === "boolean" ? [true] : [(slots[k] as { value: string }).value] } : undefined))}
            />
          </Field>
          {p.dependsOn && slots[p.dependsOn.param] && <DependsOnValues p={p} on={slots[p.dependsOn.param]} set={set} />}
        </Section>
      </fieldset>

      <Section title="Used by">
        <div className="f-wide small">
          {usage.length === 0 ? (
            <span className="muted">No item uses this answer yet. Point a field of an item at it with its slot button.</span>
          ) : (
            usage.map((id, i) => (
              <span key={id}>
                {i > 0 && ", "}
                <button type="button" className="link" onClick={() => onOpenRule(id)}>
                  {ruleLabel(id)}
                </button>
              </span>
            ))
          )}
        </div>
      </Section>
    </div>
  );
}

/** Drop keys whose value is undefined (spread `keep` above). */
const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

function DependsOnValues({ p, on, set }: { p: Param; on: Param; set: (p: Param) => void }) {
  const d = p.dependsOn!;
  const options = on.type === "boolean" ? ["yes", "no"] : on.type === "choice" ? [...on.options] : [];
  const selected = d.values.map((v) => (v === true ? "yes" : v === false ? "no" : String(v)));
  const labels = on.type === "choice" ? on.optionLabels : undefined;
  return (
    <Field label="For the answers" group wide>
      <ToggleChips
        options={options}
        selected={selected}
        labels={labels}
        onChange={(l) => set({ ...p, dependsOn: { ...d, values: l.map((v) => (on.type === "boolean" ? v === "yes" : v)) } } as Param)}
      />
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
  if (p.type === "number")
    return (
      <Section title="Number">
        <Field label="Unit">
          <UnitInput value={p.unit} onChange={(u) => set(put(p, "unit", u))} />
        </Field>
        <Field label="Lowest allowed">
          <Num value={p.min} onChange={(v) => set(put(p, "min", v))} placeholder="no limit" />
        </Field>
        <Field label="Highest allowed">
          <Num value={p.max} onChange={(v) => set(put(p, "max", v))} placeholder="no limit" />
        </Field>
      </Section>
    );
  if (p.type === "choice") {
    const opts = [...p.options];
    const setOptions = (next: string[], labels = p.optionLabels) => {
      const kept = labels && Object.fromEntries(Object.entries(labels).filter(([k]) => next.includes(k)));
      set(put({ ...p, options: next, value: next.includes(p.value) ? p.value : next[0] ?? "" }, "optionLabels", kept && Object.keys(kept).length ? kept : undefined));
    };
    return (
      <Section title="Possible answers" hint="Each answer has a stored name (what items and follow-ups refer to) and the text people see.">
        <div className="f-wide options-edit">
          {opts.map((o, i) => (
            <div key={i} className="kv-row opt-row">
              <LazyText
                mono
                value={o}
                onCommit={(n) => {
                  const nn = n.trim();
                  if (!nn || (nn !== o && opts.includes(nn))) return;
                  if (nn === o) return;
                  const labels = p.optionLabels && Object.fromEntries(Object.entries(p.optionLabels).map(([k, v]) => [k === o ? nn : k, v]));
                  onRenameOption(put({ ...p, options: replaceAt(opts, i, nn), value: p.value === o ? nn : p.value }, "optionLabels", labels), o, nn);
                }}
              />
              <Text
                value={p.optionLabels?.[o]}
                placeholder={o.replace(/_/g, " ")}
                onChange={(v) => {
                  const labels = put({ ...(p.optionLabels ?? {}) }, o, v);
                  set(put(p, "optionLabels", Object.keys(labels).length ? labels : undefined));
                }}
              />
              <span className="row-btns">
                <button type="button" className="icon" aria-label="Move up" disabled={i === 0} onClick={() => setOptions(move(opts, i, -1))}>
                  ↑
                </button>
                <button type="button" className="icon" aria-label={`Remove ${o}`} disabled={opts.length <= 1} onClick={() => setOptions(removeAt(opts, i))}>
                  ×
                </button>
              </span>
            </div>
          ))}
          <button type="button" className="link small" onClick={() => setOptions([...opts, uniqueId(`option_${opts.length + 1}`, opts)])}>
            + Add an answer
          </button>
          <p className="note small">Items that choose a way of measuring by this answer (“Choose by slot”) need one option per answer. Renaming an answer here renames it there too, and in follow-up questions and formulas.</p>
        </div>
      </Section>
    );
  }
  if (p.type === "formula") {
    const choices = p.choices ?? [];
    const setChoices = (c: { label: string; value: string }[]) => set(put(p, "choices", c.length ? c : undefined));
    return (
      <Section title="Formula" hint="The formula is the answer. Ready-made formulas are offered as a pick list in Settings.">
        <Field label="Unit of the result">
          <UnitInput value={p.unit} onChange={(u) => set(put(p, "unit", u))} />
        </Field>
        <Field label="What it can use" wide hint="In words, shown under the answer, e.g. “The footing: length, width, height”.">
          <Text value={p.variables} onChange={(v) => set(put(p, "variables", v))} />
        </Field>
        <div className="f-wide">
          <span className="f-label">Ready-made formulas</span>
          {choices.map((c, i) => (
            <div key={i} className="choice-edit">
              <div className="choice-head">
                <Text value={c.label} onChange={(v) => setChoices(replaceAt(choices, i, { ...c, label: v ?? "" }))} placeholder="Name, e.g. Both faces" optional={false} />
                <button type="button" className="icon" aria-label="Move up" disabled={i === 0} onClick={() => setChoices(move(choices, i, -1))}>
                  ↑
                </button>
                <button type="button" className="icon" aria-label={`Remove ${c.label}`} onClick={() => setChoices(removeAt(choices, i))}>
                  ×
                </button>
              </div>
              <ExprInput value={c.value} onChange={(v) => setChoices(replaceAt(choices, i, { ...c, value: v ?? "" }))} slots={slots} />
            </div>
          ))}
          <div className="lt-add">
            <button type="button" className="link small" onClick={() => setChoices([...choices, { label: "New formula", value: p.value }])}>
              + Add the current answer as a ready-made formula
            </button>
          </div>
        </div>
      </Section>
    );
  }
  return null;
}

/* ---------------------------------------------------------------- sections */

/** The sections a set shows: its own, or for a patch the parent's merged with its own (as the engine does). */
export function effectiveSections(doc: OurRuleType, parent: RuleSet | null): RuleSection[] {
  if (!isPatch(doc)) return (doc as RuleSet).sections ?? [];
  const out = new Map((parent?.sections ?? []).map((s) => [s.id, s]));
  for (const s of doc.sections ?? []) out.set(s.id, { ...out.get(s.id), ...s });
  return [...out.values()];
}

function SectionsEditor({ doc, onChange, parent, slots }: { doc: OurRuleType; onChange: (d: OurRuleType) => void; parent: RuleSet | null; slots: Slots }) {
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
  const add = () => setMine([...mine, { id: uniqueId("new-section", shown.map((s) => s.id)), title: "New section" }]);
  const rename = (from: string, to: string) => {
    const id = slug(to);
    if (!id || id === from || shown.some((s) => s.id === id)) return;
    const params = Object.fromEntries(Object.entries(doc.params ?? {}).map(([k, p]) => [k, "type" in p && p.section === from ? { ...p, section: id } : p]));
    onChange({ ...doc, params, sections: mine.map((s) => (s.id === from ? { ...s, id } : s)) } as OurRuleType);
  };

  return (
    <details className="sections-edit">
      <summary>
        Sections ({shown.length}): the groups and order of the Settings tab
      </summary>
      <div className="kv">
        <div className="kv-row kv-head sec-row">
          <span>Title</span>
          <span>Introduction (optional)</span>
          <span>Stored as</span>
          <span />
        </div>
        {shown.map((s) => {
          const fromParent = patch && inherited.has(s.id);
          const i = mine.findIndex((x) => x.id === s.id);
          return (
            <div key={s.id} className="kv-row sec-row">
              <Text value={s.title} onChange={(v) => update({ ...s, title: v ?? "" })} optional={false} />
              <Text value={s.intro} onChange={(v) => update(put(s, "intro", v))} />
              {fromParent ? <code className="small">{s.id}</code> : <LazyText mono value={s.id} onCommit={(v) => rename(s.id, v)} />}
              <span className="row-btns">
                {!patch && (
                  <button type="button" className="icon" aria-label="Move up" disabled={i <= 0} onClick={() => setMine(move(mine, i, -1))}>
                    ↑
                  </button>
                )}
                {fromParent ? (
                  i >= 0 && (
                    <button type="button" className="link small" onClick={() => setMine(removeAt(mine, i))} title="Use the parent's title">
                      reset
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="icon"
                    aria-label={`Remove section ${s.title}`}
                    onClick={() => (count(s.id) === 0 || window.confirm(`${count(s.id)} question(s) are in “${s.title}”. They move to “Other settings”. Remove the section?`)) && setMine(removeAt(mine, i))}
                  >
                    ×
                  </button>
                )}
              </span>
            </div>
          );
        })}
        <button type="button" className="link small" onClick={add}>
          + Add a section
        </button>
        {patch && <p className="muted small">The parent's sections keep their order; a new title here replaces the parent's, and new sections come after them.</p>}
      </div>
    </details>
  );
}
