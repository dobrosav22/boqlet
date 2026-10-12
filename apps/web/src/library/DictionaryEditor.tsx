/**
 * Dictionary editor (input 4): terms (the vocabulary, as a tree), entries (raw text -> term)
 * and extractors (values pulled out of names).
 */
import { useId, useMemo, useState } from "react";
import type { DictField, Dictionary, DictionaryEntry, Extractor, ModelSummary, PresetsResponse, Term, TextMatch } from "@ifc-boq/types";
import { DICT_FIELDS, EXTRACT_TARGETS, TERM_CATEGORIES, UNITS } from "./vocab";
import { Check, ExprInput, Field, KeyValue, LazyText, Num, Options, RowList, Section, Select, StringList, Text, TextArea, ToggleChips, matches, type RowInfo } from "./fields";
import { JsonTab } from "./JsonTab";
import { NamesTab } from "./NamesTab";
import { put, removeAt, replaceAt, uniqueId } from "./store";

type Tab = "names" | "overview" | "terms" | "entries" | "extractors" | "json";
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
  const terms = doc.terms ?? [];
  /** Terms this dictionary can point to: its own plus every term in the other dictionaries. */
  const known = useMemo(() => {
    const out = new Map<string, KnownTerm>((presets?.terms ?? []).map((t) => [t.id, t]));
    for (const t of terms) out.set(t.id, { id: t.id, label: t.label, category: t.category });
    return [...out.values()].sort((a, b) => a.id.localeCompare(b.id));
  }, [presets, terms]);

  const tabs: [Tab, string][] = [
    ["names", model ? "Names in the model" : "Names in a model"],
    ["overview", "Overview"],
    ["entries", `Entries (advanced, ${doc.entries.length})`],
    ["terms", `Terms (${terms.length})`],
    ["extractors", `Extractors (${doc.extractors?.length ?? 0})`],
    ["json", "JSON"],
  ];
  return (
    <>
      <nav className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "tab active" : "tab"} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="panel">
        {tab === "names" && <NamesTab doc={doc} onChange={onChange} presets={presets} model={model} known={known} loadDictionary={loadDictionary} onOpenBoq={onOpenBoq} />}
        {tab === "overview" && <Overview doc={doc} onChange={onChange} />}
        {tab === "terms" && <TermsTab doc={doc} onChange={onChange} known={known} />}
        {tab === "entries" && <EntriesTab doc={doc} onChange={onChange} known={known} />}
        {tab === "extractors" && <ExtractorsTab doc={doc} onChange={onChange} />}
        {tab === "json" && <JsonTab value={doc} onChange={onChange} />}
      </div>
    </>
  );
}

function Overview({ doc, onChange }: { doc: Dictionary; onChange: (d: Dictionary) => void }) {
  return (
    <div className="form">
      <Section title="Identity">
        <Field label="Name">
          <Text value={doc.name} onChange={(v) => onChange({ ...doc, name: v ?? "" })} optional={false} />
        </Field>
        <Field label="Id" hint="Also the file name: presets/dictionaries/<id>.json">
          <Text mono value={doc.id} onChange={(v) => onChange({ ...doc, id: v ?? "" })} optional={false} />
        </Field>
        <Field label="Version">
          <Text value={doc.version} onChange={(v) => onChange({ ...doc, version: v ?? "" })} optional={false} />
        </Field>
        <Field label="Layer" hint="When several dictionaries match a name, project wins over company, company over global.">
          <Select value={doc.layer} options={["global", "company", "project"] as const} onChange={(v) => onChange({ ...doc, layer: v ?? "company" })} />
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

  // Depth-first tree over this dictionary's terms. Parents from other dictionaries start a root.
  const rows: RowInfo[] = [];
  const children = (parent: string | undefined) => terms.filter((t) => (parent === undefined ? !t.broader || !ownIds.has(t.broader) : t.broader === parent));
  const walk = (list: Term[], depth: number) => {
    for (const t of list) {
      if (matches(q, t.id, t.label)) {
        const outside = depth === 0 && t.broader ? ` · under ${t.broader}` : "";
        rows.push({ key: t.id, title: `${" ".repeat(depth)}${t.label}`, sub: `${" ".repeat(depth)}${t.id} · ${t.category}${outside}` });
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
        Terms are the clean vocabulary rules match on. A term <i>under</i> another is matched by it: a rule for “material under concrete” also takes <code>concrete.in_situ</code>.
      </p>
      <div className="ld">
        <RowList rows={rows} selected={sel} onSelect={setSel} onAdd={() => add()} addLabel="+ New term" filter={q} onFilter={setQ} empty="No terms in this dictionary. Entries can still point to terms defined in other dictionaries." />
        <div className="ld-detail">
          {!term && <p className="muted">Select a term.</p>}
          {term && (
            <>
              <div className="ld-actions">
                <button type="button" className="ghost small-btn" onClick={() => add(term.id)}>
                  + Narrower term
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
                <span className="muted small">{usedBy(term.id)} entries point here</span>
              </div>
              <div className="form">
                <Section title="Term">
                  <Field label="Label">
                    <Text value={term.label} onChange={(v) => update({ ...term, label: v ?? "" })} optional={false} />
                  </Field>
                  <Field label="Id" hint="Dotted for readability; the hierarchy comes from “Under”.">
                    <LazyText mono value={term.id} onCommit={(v) => v.trim() && update({ ...term, id: v.trim() })} />
                  </Field>
                  <Field label="Category">
                    <Select value={term.category} options={TERM_CATEGORIES} onChange={(v) => update({ ...term, category: v ?? "material" })} />
                  </Field>
                  <Field label="Under (broader term)">
                    <Text mono list={listId} value={term.broader} onChange={(v) => update(put(term, "broader", v))} placeholder="(top level)" />
                    <Options id={listId} values={known.filter((k) => k.id !== term.id).map((k) => k.id)} labels={Object.fromEntries(known.map((k) => [k.id, k.label]))} />
                  </Field>
                  <Field label="Deprecated" group>
                    <Check checked={!!term.deprecated} onChange={(v) => update(put(term, "deprecated", v || undefined))} label="Keep for old answers, do not offer" />
                  </Field>
                </Section>
                <Section title="Labels per language">
                  <div className="f-wide">
                    <KeyValue value={term.labels} onChange={(v) => update(put(term, "labels", v as Record<string, string> | undefined))} keyLabel="Language" valueLabel="Label" />
                  </div>
                </Section>
                <Section title="Properties" hint="Values rules may use, e.g. density_kg_m3 for mass by volume.">
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
const MATCH_LABEL: Record<MatchKind, string> = { exact: "is exactly", startsWith: "starts with", contains: "contains", regex: "matches regex" };
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
      title: `${matchValues(e.match).join(" | ")} → ${label(e.term) ?? e.term}`,
      sub: `${fieldList(e.field).join(", ")} ${MATCH_LABEL[matchKind(e.match)]}${e.when ? " · only when …" : ""}`,
      badge: known.some((k) => k.id === e.term) ? undefined : { text: "unknown term", tone: "removed" as const },
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
      <p className="hint">Each entry says: when this raw text appears in these fields of an element, it means this term. First match wins (exact, then starts with, then regex, then contains). Case and accents are ignored unless set otherwise.</p>
      <div className="ld">
        <RowList rows={rows} selected={sel === null ? null : String(sel)} onSelect={(k) => setSel(Number(k))} onAdd={add} addLabel="+ New entry" filter={q} onFilter={setQ} />
        <div className="ld-detail">
          {!entry && <p className="muted">Select an entry.</p>}
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
              <div className="form">
                <Section title="When the model says">
                  <Field label="In fields" group wide>
                    <ToggleChips options={DICT_FIELDS} selected={fieldList(entry.field).filter((f) => !f.startsWith("props.")) as (typeof DICT_FIELDS)[number][]} onChange={(l) => {
                      const props = fieldList(entry.field).filter((f) => f.startsWith("props."));
                      const all = [...l, ...props];
                      set({ ...entry, field: all.length === 1 ? all[0] : all });
                    }} />
                    <StringList mono values={fieldList(entry.field).filter((f) => f.startsWith("props.")) as string[]} onChange={(v) => {
                      const base = fieldList(entry.field).filter((f) => !f.startsWith("props."));
                      const all = [...base, ...((v ?? []) as DictField[])];
                      set({ ...entry, field: all.length === 1 ? all[0] : all });
                    }} placeholder="props.Pset.Property (optional)" />
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
                    <Check checked={!!entry.caseSensitive} onChange={(v) => set(put(entry, "caseSensitive", v || undefined))} label="case sensitive" />
                    <Check checked={entry.ignoreAccents !== false} onChange={(v) => set(put(entry, "ignoreAccents", v ? undefined : false))} label="ignore accents (č = c)" />
                  </Field>
                  <Field label="Only when" wide hint='Context, e.g. ifc_class = "IfcCovering": the same text can mean different things on different elements.'>
                    <ExprInput value={entry.when} onChange={(v) => set(put(entry, "when", v))} placeholder='ifc_class = "IfcCovering"' />
                  </Field>
                </Section>
                <Section title="It means">
                  <Field label="Term" hint={label(entry.term) ?? (entry.term ? "Not defined in any dictionary" : undefined)}>
                    <Text mono list={termListId} value={entry.term} onChange={(v) => set({ ...entry, term: v ?? "" })} optional={false} placeholder="concrete.in_situ" />
                    <Options id={termListId} values={known.map((k) => k.id)} labels={Object.fromEntries(known.map((k) => [k.id, `${k.label} (${k.category})`]))} />
                  </Field>
                </Section>
                <Section title="Record">
                  <Field label="Id">
                    <Text mono value={entry.id} onChange={(v) => set({ ...entry, id: v ?? "" })} optional={false} />
                  </Field>
                  <Field label="Source">
                    <Select value={entry.source} options={["seed", "user", "import", "ai_confirmed"] as const} onChange={(v) => set({ ...entry, source: v ?? "user" })} />
                  </Field>
                  <Field label="Confidence">
                    <Num value={entry.confidence} onChange={(v) => set(put(entry, "confidence", v))} step={0.05} placeholder="1" />
                  </Field>
                  <Field label="Created by">
                    <Text value={entry.createdBy} onChange={(v) => set(put(entry, "createdBy", v))} />
                  </Field>
                  <Field label="Note" wide>
                    <TextArea value={entry.note} onChange={(v) => set(put(entry, "note", v))} rows={2} />
                  </Field>
                </Section>
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
  const targetsId = useId();
  const unitsId = useId();
  const setList = (l: Extractor[]) => onChange(put(doc, "extractors", l));
  const x = sel !== null ? list[sel] : undefined;
  const set = (e: Extractor) => setList(replaceAt(list, sel!, e));
  const rows: RowInfo[] = list.map((e, i) => ({ key: String(i), title: e.id, sub: `${fieldList(e.field).join(", ")} → ${Object.values(e.outputs).map((o) => o.target).join(", ")}` }));
  const groups = x ? groupNames(x.regex) : [];
  const outputs = x ? Object.entries(x.outputs) : [];

  return (
    <>
      <p className="hint">Extractors pull values out of names with a regular expression: a thickness from “Wall 25cm”, a strength class from “C30/37”, Revit’s family and type from “Family:Type:123”. Each named group becomes an output.</p>
      <div className="ld">
        <RowList
          rows={rows}
          selected={sel === null ? null : String(sel)}
          onSelect={(k) => setSel(Number(k))}
          onAdd={() => {
            setList([...list, { id: uniqueId("extractor", list.map((e) => e.id)), field: "type_name", regex: "(?<t>\\d+)\\s?mm", outputs: { t: { target: "thickness", unit: "mm" } } }]);
            setSel(list.length);
          }}
          addLabel="+ New extractor"
        />
        <div className="ld-detail">
          {!x && <p className="muted">Select an extractor.</p>}
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
              <div className="form">
                <Section title="Extractor">
                  <Field label="Id">
                    <Text mono value={x.id} onChange={(v) => set({ ...x, id: v ?? "" })} optional={false} />
                  </Field>
                  <Field label="Reads fields" group wide>
                    <ToggleChips options={DICT_FIELDS} selected={fieldList(x.field) as (typeof DICT_FIELDS)[number][]} onChange={(l) => set({ ...x, field: l.length === 1 ? l[0] : l })} />
                  </Field>
                  <Field label="Regular expression" wide hint="JavaScript syntax with named groups: (?<name>…)">
                    <Text mono value={x.regex} onChange={(v) => set({ ...x, regex: v ?? "" })} optional={false} />
                  </Field>
                  <Field label="Flags">
                    <Text mono value={x.flags} onChange={(v) => set(put(x, "flags", v))} placeholder="i" />
                  </Field>
                  <Field label="Overwrite model values" group>
                    <Check checked={!!x.override} onChange={(v) => set(put(x, "override", v || undefined))} label="Yes (default: geometry wins over names)" />
                  </Field>
                  <Field label="Only when" wide>
                    <ExprInput value={x.when} onChange={(v) => set(put(x, "when", v))} />
                  </Field>
                </Section>
                <Section title="Outputs" hint={groups.length ? `Named groups in the expression: ${groups.join(", ")}` : "The expression has no named groups yet."}>
                  <div className="f-wide">
                    {outputs.map(([name, o], i) => (
                      <div key={i} className="kv-row three">
                        <LazyText mono value={name} onCommit={(n) => set({ ...x, outputs: Object.fromEntries(outputs.map((r, j) => (j === i ? [n, r[1]] : r))) })} />
                        <Text mono list={targetsId} value={o.target} onChange={(v) => set({ ...x, outputs: { ...x.outputs, [name]: { ...o, target: (v ?? "term") as typeof o.target } } })} optional={false} />
                        <Text list={unitsId} value={o.unit} onChange={(v) => set({ ...x, outputs: { ...x.outputs, [name]: put(o, "unit", v) } })} placeholder="unit of the number" />
                        <button type="button" className="icon" aria-label={`Remove output ${name}`} onClick={() => set({ ...x, outputs: Object.fromEntries(outputs.filter((_, j) => j !== i)) })}>
                          ×
                        </button>
                        {!groups.includes(name) && <span className="error small">no group named “{name}” in the expression</span>}
                      </div>
                    ))}
                    <Options id={targetsId} values={EXTRACT_TARGETS} />
                    <Options id={unitsId} values={UNITS} />
                    <button
                      type="button"
                      className="link small"
                      onClick={() => {
                        const name = groups.find((g) => !(g in x.outputs)) ?? `out${outputs.length + 1}`;
                        set({ ...x, outputs: { ...x.outputs, [name]: { target: "term" } } });
                      }}
                    >
                      + Output
                    </button>
                  </div>
                </Section>
                <Field label="Note" wide>
                  <TextArea value={x.note} onChange={(v) => set(put(x, "note", v))} rows={2} />
                </Field>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
