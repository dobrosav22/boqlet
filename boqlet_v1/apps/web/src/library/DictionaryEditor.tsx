/**
 * Dictionary editor (input 4): what names in a model mean. Tabs, like the other editors:
 *   Names in a model   every name a loaded IFC uses, what it means, answer the open ones (NamesTab)
 *   Names it explains  the entries (raw text -> term), one sentence each
 *   Meanings           the terms this dictionary defines (the vocabulary, as a tree)
 *   Advanced           values read from names (extractors), about this dictionary, JSON
 * Above them, the dictionary in a few sentences (dictStory.tsx).
 */
import { useId, useMemo, useState } from "react";
import type { DictField, Dictionary, DictionaryEntry, ExtractTarget, Extractor, ModelSummary, PresetsResponse, Term, TextMatch } from "@ifc-boq/types";
import { DICT_FIELDS, EXTRACT_TARGETS, TERM_CATEGORIES, UNITS } from "./vocab";
import { Check, ExprInput, Field, KeyValue, LazyText, Num, Options, RowList, Section, Select, StringList, Text, TextArea, ToggleChips, matches, type RowInfo } from "./fields";
import { JsonTab } from "./JsonTab";
import { NamesTab } from "./NamesTab";
import { CATEGORY_WORDS, DictStory, FIELD_WORDS, TARGET_WORDS, entrySentence, extractorSentence, fieldsWords, termSentence, type DictPart } from "./dictStory";
import { put, removeAt, replaceAt, uniqueId } from "./store";

type Tab = "names" | "entries" | "terms" | "advanced";
type AdvancedTab = "extractors" | "about" | "json";
type KnownTerm = { id: string; label: string; category: string };

export function DictionaryEditor({ doc, onChange, presets, model, loadDictionary, onOpenBoq }: {
  doc: Dictionary;
  onChange: (d: Dictionary) => void;
  presets: PresetsResponse | null;
  model: ModelSummary | null;
  loadDictionary: (id: string) => Promise<Dictionary>;
  onOpenBoq: () => void;
}) {
  const [tab, setTab] = useState<Tab>("names");
  const [advanced, setAdvanced] = useState<AdvancedTab>("extractors");
  const terms = doc.terms ?? [];
  /** Terms this dictionary can point to: its own plus every term in the other dictionaries. */
  const known = useMemo(() => {
    const out = new Map<string, KnownTerm>((presets?.terms ?? []).map((t) => [t.id, t]));
    for (const t of terms) out.set(t.id, { id: t.id, label: t.label, category: t.category });
    return [...out.values()].sort((a, b) => a.id.localeCompare(b.id));
  }, [presets, terms]);

  const label = (id: string) => known.find((k) => k.id === id)?.label;
  const jump = (p: DictPart) => {
    if (p === "extractors" || p === "about") {
      setTab("advanced");
      setAdvanced(p);
    } else setTab(p);
  };

  const tabs: [Tab, string][] = [
    ["names", model ? "Names in the model" : "Names in a model"],
    ["entries", `Names it explains (${doc.entries.length})`],
    ["terms", `Meanings (${terms.length})`],
    ["advanced", "Advanced"],
  ];
  const advancedTabs: [AdvancedTab, string][] = [
    ["extractors", `Values read from names (${doc.extractors?.length ?? 0})`],
    ["about", "About this dictionary"],
    ["json", "JSON"],
  ];
  return (
    <>
      <DictStory doc={doc} label={label} onJump={jump} />
      <nav className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "tab active" : "tab"} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="panel">
        {tab === "names" && <NamesTab doc={doc} onChange={onChange} presets={presets} model={model} known={known} loadDictionary={loadDictionary} onOpenBoq={onOpenBoq} />}
        {tab === "terms" && <TermsTab doc={doc} onChange={onChange} known={known} />}
        {tab === "entries" && <EntriesTab doc={doc} onChange={onChange} known={known} />}
        {tab === "advanced" && (
          <>
            <div className="seg adv-nav" role="tablist">
              {advancedTabs.map(([id, l]) => (
                <button key={id} role="tab" aria-selected={advanced === id} className={advanced === id ? "on" : ""} onClick={() => setAdvanced(id)}>
                  {l}
                </button>
              ))}
            </div>
            {advanced === "extractors" && <ExtractorsTab doc={doc} onChange={onChange} />}
            {advanced === "about" && <Overview doc={doc} onChange={onChange} />}
            {advanced === "json" && <JsonTab value={doc} onChange={onChange} />}
          </>
        )}
      </div>
    </>
  );
}

function Overview({ doc, onChange }: { doc: Dictionary; onChange: (d: Dictionary) => void }) {
  return (
    <div className="form">
      <Section title="About this dictionary">
        <Field label="Name">
          <Text value={doc.name} onChange={(v) => onChange({ ...doc, name: v ?? "" })} optional={false} />
        </Field>
        <Field label="Id" hint="Also the file name: presets/dictionaries/<id>.json">
          <Text mono value={doc.id} onChange={(v) => onChange({ ...doc, id: v ?? "" })} optional={false} />
        </Field>
        <Field label="Version">
          <Text value={doc.version} onChange={(v) => onChange({ ...doc, version: v ?? "" })} optional={false} />
        </Field>
        <Field label="Layer" hint="When several dictionaries know a name, project wins over company, company over global.">
          <Select
            value={doc.layer}
            options={["global", "company", "project"] as const}
            labels={{ global: "global: names everyone uses (shipped)", company: "company: our office's names and codes", project: "project: names of one project" }}
            onChange={(v) => onChange({ ...doc, layer: v ?? "company" })}
          />
        </Field>
        <Field label="Languages" group wide>
          <StringList values={doc.locales} onChange={(v) => onChange(put(doc, "locales", v))} placeholder="en, de, sr…" />
        </Field>
      </Section>
    </div>
  );
}

/* ================================================================ terms */

function TermsTab({ doc, onChange, known }: { doc: Dictionary; onChange: (d: Dictionary) => void; known: KnownTerm[] }) {
  const terms = doc.terms ?? [];
  const [sel, setSel] = useState<string | null>(terms[0]?.id ?? null);
  const [q, setQ] = useState("");
  const listId = useId();
  const setTerms = (t: Term[]) => onChange(put(doc, "terms", t));
  const idx = terms.findIndex((t) => t.id === sel);
  const term = idx >= 0 ? terms[idx] : null;
  const ownIds = new Set(terms.map((t) => t.id));
  const usedBy = (id: string) => doc.entries.filter((e) => e.term === id).length;
  const termLabel = (id: string) => known.find((k) => k.id === id)?.label;

  // Depth-first tree over this dictionary's terms. Parents from other dictionaries start a root.
  const rows: RowInfo[] = [];
  const children = (parent: string | undefined) => terms.filter((t) => (parent === undefined ? !t.broader || !ownIds.has(t.broader) : t.broader === parent));
  const walk = (list: Term[], depth: number) => {
    for (const t of list) {
      if (matches(q, t.id, t.label)) {
        const outside = depth === 0 && t.broader ? ` · under ${t.broader}` : "";
        rows.push({ key: t.id, title: `${" ".repeat(depth)}${t.label}`, sub: `${" ".repeat(depth)}${t.id} · ${CATEGORY_WORDS[t.category].replace(/ \(.*\)$/, "")}${outside}` });
      }
      walk(children(t.id), depth + 1);
    }
  };
  walk(children(undefined), 0);

  const add = (broader?: string) => {
    const id = uniqueId(broader ? `${broader}.new` : "new_term", known.map((k) => k.id));
    const parent = broader ? terms.find((t) => t.id === broader) : undefined;
    setTerms([...terms, put({ id, category: parent?.category ?? "material", label: "New term" } as Term, "broader", broader)]);
    setSel(id);
  };
  const update = (t: Term) => {
    // Renaming a term carries its entries and children along.
    if (term && t.id !== term.id) {
      onChange({
        ...doc,
        terms: replaceAt(terms, idx, t).map((x) => (x.broader === term.id ? { ...x, broader: t.id } : x)),
        entries: doc.entries.map((e) => (e.term === term.id ? { ...e, term: t.id } : e)),
      });
      setSel(t.id);
    } else setTerms(replaceAt(terms, idx, t));
  };

  return (
    <>
      <p className="hint">
        The meanings (terms) rules and classifications work with: the clean words names are translated into. A meaning that is a kind of another counts as it: a rule for “material is
        a kind of concrete” also takes <code>concrete.in_situ</code>. Most meanings come with the global dictionary; add your own here when your office has a word the others lack.
      </p>
      <div className="ld">
        <RowList rows={rows} selected={sel} onSelect={setSel} onAdd={() => add()} addLabel="+ New meaning" filter={q} onFilter={setQ} empty="No meanings of its own: its names point to meanings other dictionaries define." />
        <div className="ld-detail">
          {!term && <p className="muted">Select a meaning.</p>}
          {term && (
            <>
              <div className="ld-actions">
                <button type="button" className="ghost small-btn" onClick={() => add(term.id)}>
                  + A kind of this
                </button>
                <button
                  type="button"
                  className="ghost small-btn danger"
                  onClick={() => {
                    setTerms(removeAt(terms, idx));
                    setSel(null);
                  }}
                >
                  Delete
                </button>
              </div>
              <div className="story">
                <p>{termSentence(term, termLabel, usedBy(term.id))}</p>
              </div>
              <div className="form">
                <Section title="The meaning">
                  <Field label="Name">
                    <Text value={term.label} onChange={(v) => update({ ...term, label: v ?? "" })} optional={false} />
                  </Field>
                  <Field label="What it is">
                    <Select value={term.category} options={TERM_CATEGORIES} labels={CATEGORY_WORDS} onChange={(v) => update({ ...term, category: v ?? "material" })} />
                  </Field>
                  <Field label="A kind of" hint="Rules for the broader meaning also take this one.">
                    <Text mono list={listId} value={term.broader} onChange={(v) => update(put(term, "broader", v))} placeholder="(nothing: top level)" />
                    <Options id={listId} values={known.filter((k) => k.id !== term.id).map((k) => k.id)} labels={Object.fromEntries(known.map((k) => [k.id, k.label]))} />
                  </Field>
                  <Field label="Id" hint="What rules and other dictionaries write, e.g. concrete.in_situ. Renaming updates the names here that use it.">
                    <LazyText mono value={term.id} onCommit={(v) => v.trim() && update({ ...term, id: v.trim() })} />
                  </Field>
                </Section>
                <details className="more-opts">
                  <summary>
                    More options{" "}
                    <span className="muted small">
                      · {[term.labels && "other languages", term.props && "values", term.refs?.length && "links", term.deprecated && "retired"].filter(Boolean).join(", ") || "other languages, values, links"}
                    </span>
                  </summary>
                <Section title="Retired">
                  <Field label="Retired" group>
                    <Check checked={!!term.deprecated} onChange={(v) => update(put(term, "deprecated", v || undefined))} label="Keep for old answers, do not offer it any more" />
                  </Field>
                </Section>
                <Section title="Name in other languages">
                  <div className="f-wide">
                    <KeyValue value={term.labels} onChange={(v) => update(put(term, "labels", v as Record<string, string> | undefined))} keyLabel="Language" valueLabel="Label" />
                  </div>
                </Section>
                <Section title="Values" hint="Values rules may use, e.g. density_kg_m3 for weight by volume.">
                  <div className="f-wide">
                    <KeyValue value={term.props} onChange={(v) => update(put(term, "props", v))} keyLabel="Property" valueLabel="Value" parse />
                  </div>
                </Section>
                <Section title="Links to other systems" hint="E.g. a bSDD URI or a Uniclass Pr code.">
                  <div className="f-wide">
                    {(term.refs ?? []).map((r, i) => (
                      <div key={i} className="kv-row three">
                        <LazyText value={r.system} placeholder="system" onCommit={(v) => update({ ...term, refs: replaceAt(term.refs!, i, { ...r, system: v }) })} />
                        <LazyText mono value={r.code} placeholder="code" onCommit={(v) => update({ ...term, refs: replaceAt(term.refs!, i, { ...r, code: v }) })} />
                        <LazyText value={r.uri ?? ""} placeholder="uri (optional)" onCommit={(v) => update({ ...term, refs: replaceAt(term.refs!, i, put(r, "uri", v || undefined)) })} />
                        <button type="button" className="icon" aria-label="Remove link" onClick={() => update(put(term, "refs", term.refs!.length > 1 ? removeAt(term.refs!, i) : undefined))}>
                          ×
                        </button>
                      </div>
                    ))}
                    <button type="button" className="link small" onClick={() => update({ ...term, refs: [...(term.refs ?? []), { system: "bSDD", code: "" }] })}>
                      + Link
                    </button>
                  </div>
                </Section>
                </details>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ================================================================ entries */

type MatchKind = "exact" | "startsWith" | "contains" | "regex";
const MATCH_LABEL: Record<MatchKind, string> = { exact: "is exactly", startsWith: "starts with", contains: "contains", regex: "matches a pattern (regular expression)" };
const matchKind = (m: TextMatch): MatchKind => ("exact" in m ? "exact" : "startsWith" in m ? "startsWith" : "contains" in m ? "contains" : "regex");
const matchValues = (m: TextMatch): string[] => {
  const v = "exact" in m ? m.exact : "startsWith" in m ? m.startsWith : "contains" in m ? m.contains : m.regex;
  return Array.isArray(v) ? v : [v];
};
const fieldList = (f: DictionaryEntry["field"]) => (Array.isArray(f) ? f : [f]);

function EntriesTab({ doc, onChange, known }: { doc: Dictionary; onChange: (d: Dictionary) => void; known: KnownTerm[] }) {
  const [sel, setSel] = useState<number | null>(doc.entries.length ? 0 : null);
  const [q, setQ] = useState("");
  const termListId = useId();
  const label = (id: string) => known.find((k) => k.id === id)?.label;
  const setEntries = (e: DictionaryEntry[]) => onChange({ ...doc, entries: e });
  const entry = sel !== null ? doc.entries[sel] : undefined;

  const rows: RowInfo[] = doc.entries
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => matches(q, e.id, e.term, ...matchValues(e.match), label(e.term)))
    .map(({ e, i }) => ({
      key: String(i),
      title: `${matchValues(e.match).map((v) => `“${v}”`).join(", ")} → ${label(e.term) ?? e.term}`,
      sub: `${fieldsWords(e.field)} ${MATCH_LABEL[matchKind(e.match)].replace(/ \(.*\)$/, "")}${e.when ? " · only in some cases" : ""}`,
      badge: known.some((k) => k.id === e.term) ? undefined : { text: "unknown meaning", tone: "removed" as const },
    }));

  const add = () => {
    const id = uniqueId("entry", doc.entries.map((e) => e.id));
    setEntries([...doc.entries, { id, field: ["material", "layer_material"], match: { exact: "" }, term: known[0]?.id ?? "", source: "user" }]);
    setSel(doc.entries.length);
  };
  const set = (e: DictionaryEntry) => setEntries(replaceAt(doc.entries, sel!, e));
  const setMatch = (kind: MatchKind, values: string[]) => {
    if (!entry) return;
    const one = values.length === 1 ? values[0] : values;
    const m: TextMatch = kind === "regex" ? put<{ regex: string; flags?: string }, "flags">({ regex: values[0] ?? "" }, "flags", "regex" in entry.match ? entry.match.flags : undefined) : kind === "exact" ? { exact: one } : kind === "startsWith" ? { startsWith: one } : { contains: one };
    set({ ...entry, match: m });
  };

  return (
    <>
      <p className="hint">
        Each line here says: when a model names something like this, it means that. An exact name wins over “starts with”, then a pattern, then “contains”. Capitals and accents are ignored
        unless set otherwise. The quickest way to add names is Names in a model, with a model loaded.
      </p>
      <div className="ld">
        <RowList rows={rows} selected={sel === null ? null : String(sel)} onSelect={(k) => setSel(Number(k))} onAdd={add} addLabel="+ New name" filter={q} onFilter={setQ} />
        <div className="ld-detail">
          {!entry && <p className="muted">Select a name, or add one.</p>}
          {entry && (
            <>
              <div className="ld-actions">
                <button
                  type="button"
                  className="ghost small-btn"
                  onClick={() => {
                    setEntries([...doc.entries, { ...structuredClone(entry), id: uniqueId(`${entry.id}-copy`, doc.entries.map((e) => e.id)) }]);
                    setSel(doc.entries.length);
                  }}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="ghost small-btn danger"
                  onClick={() => {
                    setEntries(removeAt(doc.entries, sel!));
                    setSel(null);
                  }}
                >
                  Delete
                </button>
              </div>
              <div className="story">
                <p>{entrySentence(entry, label)}</p>
              </div>
              <div className="form">
                <Section title="1 · When the model says">
                  <Field label="In its" group wide>
                    <ToggleChips options={DICT_FIELDS} labels={FIELD_WORDS} selected={fieldList(entry.field).filter((f) => !f.startsWith("props.")) as (typeof DICT_FIELDS)[number][]} onChange={(l) => {
                      const props = fieldList(entry.field).filter((f) => f.startsWith("props."));
                      const all = [...l, ...props];
                      set({ ...entry, field: all.length === 1 ? all[0] : all });
                    }} />
                    <StringList mono values={fieldList(entry.field).filter((f) => f.startsWith("props.")) as string[]} onChange={(v) => {
                      const base = fieldList(entry.field).filter((f) => !f.startsWith("props."));
                      const all = [...base, ...((v ?? []) as DictField[])];
                      set({ ...entry, field: all.length === 1 ? all[0] : all });
                    }} placeholder="or a property: props.Pset.Property" />
                  </Field>
                  <Field label="Text">
                    <Select value={matchKind(entry.match)} options={["exact", "startsWith", "contains", "regex"] as const} labels={MATCH_LABEL} onChange={(k) => setMatch(k ?? "exact", matchValues(entry.match))} />
                  </Field>
                  <Field label={matchKind(entry.match) === "regex" ? "Regular expression" : "Values (any of)"} group wide>
                    {matchKind(entry.match) === "regex" ? (
                      <Text mono value={matchValues(entry.match)[0]} onChange={(v) => setMatch("regex", [v ?? ""])} placeholder="^Z-?25\b" optional={false} />
                    ) : (
                      <StringList values={matchValues(entry.match).filter(Boolean)} onChange={(v) => setMatch(matchKind(entry.match), v ?? [""])} placeholder="raw text, Enter to add" />
                    )}
                  </Field>
                  <Field label="Matching" group>
                    <Check checked={!!entry.caseSensitive} onChange={(v) => set(put(entry, "caseSensitive", v || undefined))} label="capitals matter" />
                    <Check checked={entry.ignoreAccents !== false} onChange={(v) => set(put(entry, "ignoreAccents", v ? undefined : false))} label="ignore accents (č = c)" />
                  </Field>
                  <Field label="Only when" wide hint='Optional. The same name can mean different things on different elements: “CT” is ceramic tile only when ifc_class = "IfcCovering".'>
                    <ExprInput value={entry.when} onChange={(v) => set(put(entry, "when", v))} placeholder='ifc_class = "IfcCovering"' />
                  </Field>
                </Section>
                <Section title="2 · It means">
                  <Field label="Meaning" hint={label(entry.term) ?? (entry.term ? "No dictionary defines this meaning" : "Type to search the meanings")}>
                    <Text mono list={termListId} value={entry.term} onChange={(v) => set({ ...entry, term: v ?? "" })} optional={false} placeholder="concrete.in_situ" />
                    <Options id={termListId} values={known.map((k) => k.id)} labels={Object.fromEntries(known.map((k) => [k.id, `${k.label} (${k.category})`]))} />
                  </Field>
                </Section>
                <details className="more-opts">
                  <summary>
                    More options <span className="muted small">· where it came from, note, id</span>
                  </summary>
                <Section title="Record">
                  <Field label="Id">
                    <Text mono value={entry.id} onChange={(v) => set({ ...entry, id: v ?? "" })} optional={false} />
                  </Field>
                  <Field label="Came from">
                    <Select
                      value={entry.source}
                      options={["seed", "user", "import", "ai_confirmed"] as const}
                      labels={{ seed: "shipped with the app", user: "a person", import: "an import", ai_confirmed: "an AI suggestion a person confirmed" }}
                      onChange={(v) => set({ ...entry, source: v ?? "user" })}
                    />
                  </Field>
                  <Field label="How sure (0 to 1)">
                    <Num value={entry.confidence} onChange={(v) => set(put(entry, "confidence", v))} step={0.05} placeholder="1" />
                  </Field>
                  <Field label="Created by">
                    <Text value={entry.createdBy} onChange={(v) => set(put(entry, "createdBy", v))} />
                  </Field>
                  <Field label="Note" wide>
                    <TextArea value={entry.note} onChange={(v) => set(put(entry, "note", v))} rows={2} />
                  </Field>
                </Section>
                </details>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ================================================================ extractors */

const groupNames = (rx: string) => [...rx.matchAll(/\(\?<([A-Za-z_]\w*)>/g)].map((m) => m[1]);

function ExtractorsTab({ doc, onChange }: { doc: Dictionary; onChange: (d: Dictionary) => void }) {
  const list = doc.extractors ?? [];
  const [sel, setSel] = useState<number | null>(list.length ? 0 : null);
  const unitsId = useId();
  const setList = (l: Extractor[]) => onChange(put(doc, "extractors", l));
  const x = sel !== null ? list[sel] : undefined;
  const set = (e: Extractor) => setList(replaceAt(list, sel!, e));
  const rows: RowInfo[] = list.map((e, i) => ({
    key: String(i),
    title: Object.values(e.outputs).map((o) => TARGET_WORDS[o.target] ?? o.target).join(", ") || e.id,
    sub: `from the ${fieldsWords(e.field)} · ${e.id}`,
  }));
  const groups = x ? groupNames(x.regex) : [];
  const outputs = x ? Object.entries(x.outputs) : [];

  return (
    <>
      <p className="hint">
        Values written in names: a thickness in “Wall 25cm”, a strength class in “C30/37”, Revit’s family and type in “Family:Type:123”. Each reader is a pattern (a regular expression);
        each named part of it, written (?&lt;name&gt;…), gives one value. Names in a model shows what is read from each name of a loaded model. Measured values from the geometry win
        unless a reader says otherwise.
      </p>
      <div className="ld">
        <RowList
          rows={rows}
          selected={sel === null ? null : String(sel)}
          onSelect={(k) => setSel(Number(k))}
          onAdd={() => {
            setList([...list, { id: uniqueId("extractor", list.map((e) => e.id)), field: "type_name", regex: "(?<t>\\d+)\\s?mm", outputs: { t: { target: "thickness", unit: "mm" } } }]);
            setSel(list.length);
          }}
          addLabel="+ New reader"
        />
        <div className="ld-detail">
          {!x && <p className="muted">Select a reader, or add one.</p>}
          {x && (
            <>
              <div className="ld-actions">
                <button
                  type="button"
                  className="ghost small-btn danger"
                  onClick={() => {
                    setList(removeAt(list, sel!));
                    setSel(null);
                  }}
                >
                  Delete
                </button>
              </div>
              <div className="story">
                <p>{extractorSentence(x)}</p>
              </div>
              <div className="form">
                <Section title="1 · Where to look">
                  <Field label="Reads the" group wide>
                    <ToggleChips options={DICT_FIELDS} labels={FIELD_WORDS} selected={fieldList(x.field) as (typeof DICT_FIELDS)[number][]} onChange={(l) => set({ ...x, field: l.length === 1 ? l[0] : l })} />
                  </Field>
                  <Field label="Pattern (regular expression)" wide hint="JavaScript syntax; name each part you want: (?<t>\d+)\s?cm reads the number before “cm” as part t.">
                    <Text mono value={x.regex} onChange={(v) => set({ ...x, regex: v ?? "" })} optional={false} />
                  </Field>
                  <Field label="Flags">
                    <Text mono value={x.flags} onChange={(v) => set(put(x, "flags", v))} placeholder="i" />
                  </Field>
                  <Field label="Values the model already has" group>
                    <Check checked={!!x.override} onChange={(v) => set(put(x, "override", v || undefined))} label="overwrite them (usually not: geometry wins over names)" />
                  </Field>
                  <Field label="Only when" wide hint="Optional, e.g. only on walls.">
                    <ExprInput value={x.when} onChange={(v) => set(put(x, "when", v))} />
                  </Field>
                </Section>
                <Section title="2 · What each part gives" hint={groups.length ? `Named parts in the pattern: ${groups.join(", ")}` : "The pattern has no named parts yet."}>
                  <div className="f-wide">
                    {outputs.map(([name, o], i) => (
                      <div key={i} className="kv-row three">
                        <LazyText mono value={name} onCommit={(n) => set({ ...x, outputs: Object.fromEntries(outputs.map((r, j) => (j === i ? [n, r[1]] : r))) })} />
                        <select value={EXTRACT_TARGETS.includes(o.target as (typeof EXTRACT_TARGETS)[number]) ? o.target : "__other"} onChange={(e) => e.target.value !== "__other" && set({ ...x, outputs: { ...x.outputs, [name]: { ...o, target: e.target.value as ExtractTarget } } })} aria-label={`What ${name} gives`}>
                          {EXTRACT_TARGETS.map((t) => (
                            <option key={t} value={t}>
                              {TARGET_WORDS[t] ?? t}
                            </option>
                          ))}
                          {!EXTRACT_TARGETS.includes(o.target as (typeof EXTRACT_TARGETS)[number]) && <option value="__other">{o.target}</option>}
                        </select>
                        <Text list={unitsId} value={o.unit} onChange={(v) => set({ ...x, outputs: { ...x.outputs, [name]: put(o, "unit", v) } })} placeholder="unit of the number" />
                        <button type="button" className="icon" aria-label={`Remove output ${name}`} onClick={() => set({ ...x, outputs: Object.fromEntries(outputs.filter((_, j) => j !== i)) })}>
                          ×
                        </button>
                        {!groups.includes(name) && <span className="error small">no part named “{name}” in the pattern</span>}
                      </div>
                    ))}
                    <Options id={unitsId} values={UNITS} />
                    <button
                      type="button"
                      className="link small"
                      onClick={() => {
                        const name = groups.find((g) => !(g in x.outputs)) ?? `out${outputs.length + 1}`;
                        set({ ...x, outputs: { ...x.outputs, [name]: { target: "term" } } });
                      }}
                    >
                      + Value
                    </button>
                  </div>
                </Section>
                <details className="more-opts">
                  <summary>
                    More options <span className="muted small">· note, id</span>
                  </summary>
                  <Section title="Labels">
                    <Field label="Note" wide>
                      <TextArea value={x.note} onChange={(v) => set(put(x, "note", v))} rows={2} />
                    </Field>
                    <Field label="Id">
                      <Text mono value={x.id} onChange={(v) => set({ ...x, id: v ?? "" })} optional={false} />
                    </Field>
                  </Section>
                </details>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
