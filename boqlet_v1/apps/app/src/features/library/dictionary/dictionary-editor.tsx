"use client";

/**
 * Dictionary editor (input 4, F10 §3): what names in a model mean. Ported from the PoC's
 * DictionaryEditor.tsx. Tabs, like the other editors:
 *   Names in the model  every name a model version uses, what it means, answer the open ones (names-tab.tsx)
 *   Names it explains   the entries (raw text -> term), one sentence each
 *   Meanings            the terms this dictionary defines (the vocabulary, as a tree)
 *   Advanced            values read from names (extractors), about this dictionary, JSON
 * Above them, the dictionary in a few sentences (dict-story.tsx).
 */
import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import type { DictField, Dictionary, DictionaryEntry, ExtractTarget, Extractor, Term, TextMatch } from "@ifc-boq/types";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/features/orgs/org-context";
import { cn } from "@/lib/utils";
import type { EditorProps } from "../preset-editor";
import { put, removeAt, replaceAt, uniqueId } from "../shared/doc";
import { Check, ExprInput, Field, KeyValue, LazyText, Num, Options, RowList, Section, Select, StringList, Text, TextArea, ToggleChips, inputClass, linkButton, matches, type RowInfo } from "../shared/fields";
import { JsonTab } from "../shared/json-tab";
import { DICT_FIELDS, EXTRACT_TARGETS, TERM_CATEGORIES, UNITS } from "../shared/vocab";
import { DictStory, useDictWords, type DictPart } from "./dict-story";
import type { KnownTerm } from "./names";
import { NamesTab, type NamesPick } from "./names-tab";

type Tab = "names" | "entries" | "terms" | "advanced";
type AdvancedTab = "extractors" | "about" | "json";

/* Examples shown in inputs: document syntax, not language. */
const TERM_EXAMPLE = "concrete.in_situ";
const REGEX_EXAMPLE = "^Z-?25\\b";
const WHEN_EXAMPLE = 'ifc_class = "IfcCovering"';
const FLAGS_EXAMPLE = "i";
const GROUP_SYNTAX = "(?<name>…)";
const PATTERN_EXAMPLE = "(?<t>\\d+)\\s?cm";
const INDENT = "  ";

/** Tabs that stay usable when the editor is read-only (a disabled fieldset disables buttons). */
function Tabs<T extends string>({ tabs, value, onChange, label, testId, variant = "main" }: {
  tabs: [T, ReactNode][];
  value: T;
  onChange: (t: T) => void;
  label: string;
  testId: (t: T) => string;
  variant?: "main" | "sub";
}) {
  const key = (t: T) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange(t);
    }
  };
  return (
    <div role="tablist" aria-label={label} className={cn("flex", variant === "main" ? "gap-6 border-b border-border" : "gap-0")}>
      {tabs.map(([id, text]) => (
        <div
          key={id}
          role="tab"
          tabIndex={0}
          aria-selected={value === id}
          data-testid={testId(id)}
          onClick={() => onChange(id)}
          onKeyDown={key(id)}
          className={cn(
            "cursor-pointer select-none",
            variant === "main"
              ? cn("label-caps -mb-px border-b-2 border-transparent pb-2 text-muted-foreground hover:text-foreground", value === id && "border-link text-foreground")
              : cn("flex h-8 items-center border border-border px-2 first:rounded-l-[var(--radius)] last:rounded-r-[var(--radius)] hover:bg-muted", value === id && "border-foreground bg-foreground text-background hover:bg-foreground/90"),
          )}
        >
          {text}
        </div>
      ))}
    </div>
  );
}

/** Terms this dictionary can point to: the org's (system, company, the project's) plus the draft's own. */
function useKnownTerms(projectId: string | null | undefined, own: Term[]): KnownTerm[] {
  const { org } = useOrg();
  const terms = useQuery({
    queryKey: keys.terms(org.id, projectId ?? undefined),
    staleTime: 5 * 60_000,
    queryFn: async () => (await api.GET("/orgs/{orgId}/terms", { params: { path: { orgId: org.id }, query: projectId ? { projectId } : {} } })).data!,
  });
  return useMemo(() => {
    const out = new Map<string, KnownTerm>((terms.data ?? []).map((t) => [t.id, { id: t.id, label: t.label, category: t.category }]));
    for (const t of own) out.set(t.id, { id: t.id, label: t.label, category: t.category });
    return [...out.values()].sort((a, b) => a.id.localeCompare(b.id));
  }, [terms.data, own]);
}

export function DictionaryEditor({ preset, doc, onChange }: EditorProps<Dictionary>) {
  const t = useTranslations("dictionaryEditor");
  const [tab, setTab] = useState<Tab>("names");
  const [advanced, setAdvanced] = useState<AdvancedTab>("extractors");
  const [pick, setPick] = useState<NamesPick>({});
  const terms = useMemo(() => doc.terms ?? [], [doc.terms]);
  const known = useKnownTerms(preset.projectId, terms);

  const label = (id: string) => known.find((k) => k.id === id)?.label;
  const jump = (p: DictPart) => {
    if (p === "extractors" || p === "about") {
      setTab("advanced");
      setAdvanced(p);
    } else setTab(p);
  };

  const tabs: [Tab, ReactNode][] = [
    ["names", t("tabs.names")],
    ["entries", t("tabs.entries", { n: doc.entries.length })],
    ["terms", t("tabs.terms", { n: terms.length })],
    ["advanced", t("tabs.advanced")],
  ];
  const advancedTabs: [AdvancedTab, ReactNode][] = [
    ["extractors", t("advancedTabs.extractors", { n: doc.extractors?.length ?? 0 })],
    ["about", t("advancedTabs.about")],
    ["json", t("advancedTabs.json")],
  ];
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="dictionary-editor">
      <DictStory doc={doc} label={label} onJump={jump} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} label={t("tabs.label")} testId={(id) => `dict-tab-${id}`} />
      <div className="min-w-0">
        {tab === "names" && <NamesTab preset={preset} doc={doc} onChange={onChange} known={known} pick={pick} onPick={setPick} />}
        {tab === "terms" && <TermsTab doc={doc} onChange={onChange} known={known} />}
        {tab === "entries" && <EntriesTab doc={doc} onChange={onChange} known={known} />}
        {tab === "advanced" && (
          <div className="flex flex-col gap-4">
            <Tabs tabs={advancedTabs} value={advanced} onChange={setAdvanced} label={t("advancedTabs.label")} testId={(id) => `dict-advanced-${id}`} variant="sub" />
            {advanced === "extractors" && <ExtractorsTab doc={doc} onChange={onChange} />}
            {advanced === "about" && <Overview doc={doc} onChange={onChange} />}
            {advanced === "json" && <JsonTab value={doc} onChange={onChange} />}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================ about */

function Overview({ doc, onChange }: { doc: Dictionary; onChange: (d: Dictionary) => void }) {
  const t = useTranslations("dictionaryEditor.about");
  return (
    <div className="flex flex-col gap-4">
      <Section title={t("title")}>
        <Field label={t("name")}>
          <Text value={doc.name} onChange={(v) => onChange({ ...doc, name: v ?? "" })} optional={false} />
        </Field>
        <Field label={t("id")} hint={t("idHint")}>
          <Text mono value={doc.id} onChange={(v) => onChange({ ...doc, id: v ?? "" })} optional={false} />
        </Field>
        <Field label={t("version")}>
          <Text value={doc.version} onChange={(v) => onChange({ ...doc, version: v ?? "" })} optional={false} />
        </Field>
        <Field label={t("layer")} hint={t("layerHint")}>
          <Select
            value={doc.layer}
            options={["global", "company", "project"] as const}
            labels={(l) => t(`layerOptions.${l}`)}
            onChange={(v) => onChange({ ...doc, layer: v ?? "company" })}
          />
        </Field>
        <Field label={t("languages")} group wide>
          <StringList values={doc.locales} onChange={(v) => onChange(put(doc, "locales", v))} placeholder={t("languagesPlaceholder")} />
        </Field>
      </Section>
    </div>
  );
}

/* ================================================================ terms */

function TermsTab({ doc, onChange, known }: { doc: Dictionary; onChange: (d: Dictionary) => void; known: KnownTerm[] }) {
  const t = useTranslations("dictionaryEditor.terms");
  const words = useDictWords();
  const terms = doc.terms ?? [];
  const [sel, setSel] = useState<string | null>(terms[0]?.id ?? null);
  const [q, setQ] = useState("");
  const listId = useId();
  const setTerms = (list: Term[]) => onChange(put(doc, "terms", list));
  const idx = terms.findIndex((x) => x.id === sel);
  const term = idx >= 0 ? terms[idx]! : null;
  const ownIds = new Set(terms.map((x) => x.id));
  const usedBy = (id: string) => doc.entries.filter((e) => e.term === id).length;
  const termLabel = (id: string) => known.find((k) => k.id === id)?.label;

  // Depth-first tree over this dictionary's terms. Parents from other dictionaries start a root.
  const rows: RowInfo[] = [];
  const children = (parent: string | undefined) => terms.filter((x) => (parent === undefined ? !x.broader || !ownIds.has(x.broader) : x.broader === parent));
  const seen = new Set<string>();
  const walk = (list: Term[], depth: number) => {
    for (const x of list) {
      if (seen.has(x.id)) continue; // a loop in "a kind of" must not hang the list
      seen.add(x.id);
      if (matches(q, x.id, x.label)) {
        const outside = depth === 0 && !!x.broader;
        rows.push({
          key: x.id,
          title: `${INDENT.repeat(depth)}${x.label}`,
          sub: `${INDENT.repeat(depth)}${t("rowSub", { id: x.id, category: words.categoryShort(x.category), hasBroader: outside ? "yes" : "no", broader: x.broader ?? "" })}`,
        });
      }
      walk(children(x.id), depth + 1);
    }
  };
  walk(children(undefined), 0);

  const add = (broader?: string) => {
    const id = uniqueId(broader ? `${broader}.new` : "new_term", known.map((k) => k.id));
    const parent = broader ? terms.find((x) => x.id === broader) : undefined;
    setTerms([...terms, put({ id, category: parent?.category ?? "material", label: t("newLabel") } as Term, "broader", broader)]);
    setSel(id);
  };
  const update = (next: Term) => {
    // Renaming a term carries its entries and children along.
    if (term && next.id !== term.id) {
      onChange({
        ...doc,
        terms: replaceAt(terms, idx, next).map((x) => (x.broader === term.id ? { ...x, broader: next.id } : x)),
        entries: doc.entries.map((e) => (e.term === term.id ? { ...e, term: next.id } : e)),
      });
      setSel(next.id);
    } else setTerms(replaceAt(terms, idx, next));
  };
  const moreParts = term
    ? [term.labels && t("moreParts.labels"), term.props && t("moreParts.props"), term.refs?.length && t("moreParts.refs"), term.deprecated && t("moreParts.deprecated")].filter((x): x is string => !!x)
    : [];

  return (
    <div className="flex flex-col gap-4">
      <p className="prose-text text-muted-foreground">{t("hint", { example: TERM_EXAMPLE })}</p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(14rem,1fr)_2fr]">
        <RowList rows={rows} selected={sel} onSelect={setSel} onAdd={() => add()} addLabel={t("add")} filter={q} onFilter={setQ} empty={t("empty")} />
        <div className="flex min-w-0 flex-col gap-4">
          {!term && <p className="text-muted-foreground">{t("select")}</p>}
          {term && (
            <>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => add(term.id)}>
                  {t("addKind")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setTerms(removeAt(terms, idx));
                    setSel(null);
                  }}
                >
                  {t("delete")}
                </Button>
              </div>
              <p className="prose-text rounded-[var(--radius)] border border-border bg-card p-3" data-testid="term-sentence">
                {words.termSentence(term, termLabel, usedBy(term.id))}
              </p>
              <Section title={t("section")}>
                <Field label={t("name")}>
                  <Text value={term.label} onChange={(v) => update({ ...term, label: v ?? "" })} optional={false} />
                </Field>
                <Field label={t("category")}>
                  <Select value={term.category} options={TERM_CATEGORIES} labels={(c) => words.category(c)} onChange={(v) => update({ ...term, category: v ?? "material" })} />
                </Field>
                <Field label={t("broader")} hint={t("broaderHint")}>
                  <Text mono list={listId} value={term.broader} onChange={(v) => update(put(term, "broader", v))} placeholder={t("broaderPlaceholder")} />
                  <Options id={listId} values={known.filter((k) => k.id !== term.id).map((k) => k.id)} labels={Object.fromEntries(known.map((k) => [k.id, k.label]))} />
                </Field>
                <Field label={t("id")} hint={t("idHint", { example: TERM_EXAMPLE })}>
                  <LazyText mono value={term.id} onCommit={(v) => v.trim() && update({ ...term, id: v.trim() })} />
                </Field>
              </Section>
              <details className="flex flex-col gap-4">
                <summary className="cursor-pointer">
                  {t("more")} <span className="text-muted-foreground">{moreParts.length ? t("moreSummary", { parts: moreParts.join(", ") }) : t("moreDefault")}</span>
                </summary>
                <div className="flex flex-col gap-4 pt-2">
                  <Section title={t("retired")}>
                    <Field label={t("retired")} group>
                      <Check checked={!!term.deprecated} onChange={(v) => update(put(term, "deprecated", v || undefined))} label={t("retiredLabel")} />
                    </Field>
                  </Section>
                  <Section title={t("otherLanguages")}>
                    <div className="col-span-full">
                      <KeyValue value={term.labels} onChange={(v) => update(put(term, "labels", v as Record<string, string> | undefined))} keyLabel={t("language")} valueLabel={t("labelColumn")} />
                    </div>
                  </Section>
                  <Section title={t("values")} hint={t("valuesHint")}>
                    <div className="col-span-full">
                      <KeyValue value={term.props} onChange={(v) => update(put(term, "props", v))} keyLabel={t("property")} valueLabel={t("value")} parse />
                    </div>
                  </Section>
                  <Section title={t("links")} hint={t("linksHint")}>
                    <div className="col-span-full flex flex-col gap-1">
                      {(term.refs ?? []).map((r, i) => (
                        <div key={i} className="grid grid-cols-[1fr_1fr_2fr_2rem] gap-2">
                          <LazyText value={r.system} placeholder={t("linkSystem")} aria-label={t("linkSystem")} onCommit={(v) => update({ ...term, refs: replaceAt(term.refs!, i, { ...r, system: v }) })} />
                          <LazyText mono value={r.code} placeholder={t("linkCode")} aria-label={t("linkCode")} onCommit={(v) => update({ ...term, refs: replaceAt(term.refs!, i, { ...r, code: v }) })} />
                          <LazyText value={r.uri ?? ""} placeholder={t("linkUri")} aria-label={t("linkUri")} onCommit={(v) => update({ ...term, refs: replaceAt(term.refs!, i, put(r, "uri", v || undefined)) })} />
                          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={t("removeLink")} onClick={() => update(put(term, "refs", term.refs!.length > 1 ? removeAt(term.refs!, i) : undefined))}>
                            ×
                          </button>
                        </div>
                      ))}
                      <button type="button" className={cn(linkButton, "self-start")} onClick={() => update({ ...term, refs: [...(term.refs ?? []), { system: "bSDD", code: "" }] })}>
                        {t("addLink")}
                      </button>
                    </div>
                  </Section>
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================ entries */

type MatchKind = "exact" | "startsWith" | "contains" | "regex";
const MATCH_KINDS = ["exact", "startsWith", "contains", "regex"] as const;
const matchKind = (m: TextMatch): MatchKind => ("exact" in m ? "exact" : "startsWith" in m ? "startsWith" : "contains" in m ? "contains" : "regex");
export const matchValues = (m: TextMatch): string[] => {
  const v = "exact" in m ? m.exact : "startsWith" in m ? m.startsWith : "contains" in m ? m.contains : m.regex;
  return Array.isArray(v) ? v : [v];
};
const fieldList = (f: DictionaryEntry["field"]) => (Array.isArray(f) ? f : [f]);
type PlainField = (typeof DICT_FIELDS)[number];

function EntriesTab({ doc, onChange, known }: { doc: Dictionary; onChange: (d: Dictionary) => void; known: KnownTerm[] }) {
  const t = useTranslations("dictionaryEditor.entries");
  const tw = useTranslations("dictionaryEditor.words");
  const words = useDictWords();
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
      title: t("rowTitle", { values: matchValues(e.match).map((text) => tw("quoted", { text })).join(", "), term: label(e.term) ?? e.term }),
      sub: t("rowSub", { fields: words.fields(e.field), match: t(`matchShort.${matchKind(e.match)}`), hasWhen: e.when ? "yes" : "no" }),
      badge: known.some((k) => k.id === e.term) ? undefined : { text: t("unknownMeaning"), tone: "removed" as const },
    }));

  const add = () => {
    const id = uniqueId("entry", doc.entries.map((e) => e.id));
    setEntries([...doc.entries, { id, field: ["material", "layer_material"], match: { exact: "" }, term: known[0]?.id ?? "", source: "user" }]);
    setSel(doc.entries.length);
  };
  const set = (e: DictionaryEntry) => setEntries(replaceAt(doc.entries, sel!, e));
  const setMatch = (kind: MatchKind, values: string[]) => {
    if (!entry) return;
    const one = values.length === 1 ? values[0]! : values;
    const m: TextMatch =
      kind === "regex"
        ? put<{ regex: string; flags?: string }, "flags">({ regex: values[0] ?? "" }, "flags", "regex" in entry.match ? entry.match.flags : undefined)
        : kind === "exact"
          ? { exact: one }
          : kind === "startsWith"
            ? { startsWith: one }
            : { contains: one };
    set({ ...entry, match: m });
  };
  const setFields = (all: DictField[]) => entry && set({ ...entry, field: all.length === 1 ? all[0]! : all });

  return (
    <div className="flex flex-col gap-4">
      <p className="prose-text text-muted-foreground">{t("hint")}</p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(14rem,1fr)_2fr]">
        <RowList rows={rows} selected={sel === null ? null : String(sel)} onSelect={(k) => setSel(Number(k))} onAdd={add} addLabel={t("add")} filter={q} onFilter={setQ} />
        <div className="flex min-w-0 flex-col gap-4">
          {!entry && <p className="text-muted-foreground">{t("select")}</p>}
          {entry && (
            <>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEntries([...doc.entries, { ...structuredClone(entry), id: uniqueId(`${entry.id}-copy`, doc.entries.map((e) => e.id)) }]);
                    setSel(doc.entries.length);
                  }}
                >
                  {t("duplicate")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setEntries(removeAt(doc.entries, sel!));
                    setSel(null);
                  }}
                >
                  {t("delete")}
                </Button>
              </div>
              <p className="prose-text rounded-[var(--radius)] border border-border bg-card p-3" data-testid="entry-sentence">
                {words.entry(entry, label)}
              </p>
              <Section title={t("section1")}>
                <Field label={t("inIts")} group wide>
                  <ToggleChips
                    options={DICT_FIELDS}
                    labels={(f) => words.field(f)}
                    selected={fieldList(entry.field).filter((f) => !f.startsWith("props.")) as PlainField[]}
                    onChange={(l) => setFields([...l, ...fieldList(entry.field).filter((f) => f.startsWith("props."))])}
                  />
                  <StringList
                    mono
                    values={fieldList(entry.field).filter((f) => f.startsWith("props.")) as string[]}
                    onChange={(v) => setFields([...fieldList(entry.field).filter((f) => !f.startsWith("props.")), ...((v ?? []) as DictField[])])}
                    placeholder={t("propsPlaceholder")}
                  />
                </Field>
                <Field label={t("text")}>
                  <Select value={matchKind(entry.match)} options={MATCH_KINDS} labels={(k) => t(`matchKinds.${k}`)} onChange={(k) => setMatch(k ?? "exact", matchValues(entry.match))} />
                </Field>
                <Field label={matchKind(entry.match) === "regex" ? t("regex") : t("values")} group wide>
                  {matchKind(entry.match) === "regex" ? (
                    <Text mono value={matchValues(entry.match)[0]} onChange={(v) => setMatch("regex", [v ?? ""])} placeholder={REGEX_EXAMPLE} optional={false} aria-label={t("regex")} />
                  ) : (
                    <StringList values={matchValues(entry.match).filter(Boolean)} onChange={(v) => setMatch(matchKind(entry.match), v ?? [""])} placeholder={t("valuesPlaceholder")} aria-label={t("values")} data-testid="entry-values" />
                  )}
                </Field>
                <Field label={t("matching")} group>
                  <Check checked={!!entry.caseSensitive} onChange={(v) => set(put(entry, "caseSensitive", v || undefined))} label={t("caseSensitive")} />
                  <Check checked={entry.ignoreAccents !== false} onChange={(v) => set(put(entry, "ignoreAccents", v ? undefined : false))} label={t("ignoreAccents")} />
                </Field>
                <Field label={t("onlyWhen")} wide hint={t("onlyWhenHint", { example: WHEN_EXAMPLE })}>
                  <ExprInput value={entry.when} onChange={(v) => set(put(entry, "when", v))} placeholder={WHEN_EXAMPLE} />
                </Field>
              </Section>
              <Section title={t("section2")}>
                <Field label={t("meaning")} hint={label(entry.term) ?? (entry.term ? t("meaningUnknown") : t("meaningSearch"))}>
                  <Text mono list={termListId} value={entry.term} onChange={(v) => set({ ...entry, term: v ?? "" })} optional={false} placeholder={TERM_EXAMPLE} data-testid="entry-term" />
                  <Options id={termListId} values={known.map((k) => k.id)} labels={Object.fromEntries(known.map((k) => [k.id, t("termOption", { label: k.label, category: words.categoryShort(k.category) })]))} />
                </Field>
              </Section>
              <details className="flex flex-col gap-4">
                <summary className="cursor-pointer">
                  {t("more")} <span className="text-muted-foreground">{t("moreSummary")}</span>
                </summary>
                <div className="pt-2">
                  <Section title={t("record")}>
                    <Field label={t("id")}>
                      <Text mono value={entry.id} onChange={(v) => set({ ...entry, id: v ?? "" })} optional={false} />
                    </Field>
                    <Field label={t("source")}>
                      <Select value={entry.source} options={["seed", "user", "import", "ai_confirmed"] as const} labels={(s) => t(`sources.${s}`)} onChange={(v) => set({ ...entry, source: v ?? "user" })} />
                    </Field>
                    <Field label={t("confidence")}>
                      <Num value={entry.confidence} onChange={(v) => set(put(entry, "confidence", v))} step={0.05} placeholder="1" />
                    </Field>
                    <Field label={t("createdBy")}>
                      <Text value={entry.createdBy} onChange={(v) => set(put(entry, "createdBy", v))} />
                    </Field>
                    <Field label={t("note")} wide>
                      <TextArea value={entry.note} onChange={(v) => set(put(entry, "note", v))} rows={2} />
                    </Field>
                  </Section>
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================ extractors */

export const groupNames = (rx: string) => [...rx.matchAll(/\(\?<([A-Za-z_]\w*)>/g)].map((m) => m[1]!);

function ExtractorsTab({ doc, onChange }: { doc: Dictionary; onChange: (d: Dictionary) => void }) {
  const t = useTranslations("dictionaryEditor.extractors");
  const words = useDictWords();
  const list = doc.extractors ?? [];
  const [sel, setSel] = useState<number | null>(list.length ? 0 : null);
  const unitsId = useId();
  const setList = (l: Extractor[]) => onChange(put(doc, "extractors", l));
  const x = sel !== null ? list[sel] : undefined;
  const set = (e: Extractor) => setList(replaceAt(list, sel!, e));
  const rows: RowInfo[] = list.map((e, i) => ({
    key: String(i),
    title: Object.values(e.outputs).map((o) => words.target(o.target)).join(", ") || e.id,
    sub: t("rowSub", { fields: words.fields(e.field), id: e.id }),
  }));
  const groups = x ? groupNames(x.regex) : [];
  const outputs = x ? Object.entries(x.outputs) : [];
  const isKnownTarget = (target: string) => (EXTRACT_TARGETS as readonly string[]).includes(target);

  return (
    <div className="flex flex-col gap-4">
      <p className="prose-text text-muted-foreground">{t("hint", { syntax: GROUP_SYNTAX })}</p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(14rem,1fr)_2fr]">
        <RowList
          rows={rows}
          selected={sel === null ? null : String(sel)}
          onSelect={(k) => setSel(Number(k))}
          onAdd={() => {
            setList([...list, { id: uniqueId("extractor", list.map((e) => e.id)), field: "type_name", regex: "(?<t>\\d+)\\s?mm", outputs: { t: { target: "thickness", unit: "mm" } } }]);
            setSel(list.length);
          }}
          addLabel={t("add")}
        />
        <div className="flex min-w-0 flex-col gap-4">
          {!x && <p className="text-muted-foreground">{t("select")}</p>}
          {x && (
            <>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setList(removeAt(list, sel!));
                    setSel(null);
                  }}
                >
                  {t("delete")}
                </Button>
              </div>
              <p className="prose-text rounded-[var(--radius)] border border-border bg-card p-3" data-testid="extractor-sentence">
                {words.extractor(x)}
              </p>
              <Section title={t("section1")}>
                <Field label={t("reads")} group wide>
                  <ToggleChips options={DICT_FIELDS} labels={(f) => words.field(f)} selected={fieldList(x.field) as PlainField[]} onChange={(l) => set({ ...x, field: l.length === 1 ? l[0]! : l })} />
                </Field>
                <Field label={t("pattern")} wide hint={t("patternHint", { example: PATTERN_EXAMPLE })}>
                  <Text mono value={x.regex} onChange={(v) => set({ ...x, regex: v ?? "" })} optional={false} />
                </Field>
                <Field label={t("flags")}>
                  <Text mono value={x.flags} onChange={(v) => set(put(x, "flags", v))} placeholder={FLAGS_EXAMPLE} />
                </Field>
                <Field label={t("existing")} group>
                  <Check checked={!!x.override} onChange={(v) => set(put(x, "override", v || undefined))} label={t("override")} />
                </Field>
                <Field label={t("onlyWhen")} wide hint={t("onlyWhenHint")}>
                  <ExprInput value={x.when} onChange={(v) => set(put(x, "when", v))} />
                </Field>
              </Section>
              <Section title={t("section2")} hint={groups.length ? t("parts", { names: groups.join(", ") }) : t("noParts")}>
                <div className="col-span-full flex flex-col gap-1">
                  {outputs.map(([name, o], i) => (
                    <div key={i} className="grid grid-cols-[1fr_1.5fr_1fr_2rem] items-start gap-2">
                      <LazyText mono value={name} aria-label={t("partName")} onCommit={(n) => set({ ...x, outputs: Object.fromEntries(outputs.map((r, j) => (j === i ? [n, r[1]] : r))) })} />
                      <select
                        className={inputClass}
                        value={isKnownTarget(o.target) ? o.target : "__other"}
                        onChange={(e) => e.target.value !== "__other" && set({ ...x, outputs: { ...x.outputs, [name]: { ...o, target: e.target.value as ExtractTarget } } })}
                        aria-label={t("gives", { name })}
                      >
                        {EXTRACT_TARGETS.map((target) => (
                          <option key={target} value={target}>
                            {words.target(target)}
                          </option>
                        ))}
                        {!isKnownTarget(o.target) && <option value="__other">{o.target}</option>}
                      </select>
                      <Text list={unitsId} value={o.unit} onChange={(v) => set({ ...x, outputs: { ...x.outputs, [name]: put(o, "unit", v) } })} placeholder={t("unitPlaceholder")} aria-label={t("unit", { name })} />
                      <button type="button" className="h-8 text-muted-foreground hover:text-foreground" aria-label={t("removeOutput", { name })} onClick={() => set({ ...x, outputs: Object.fromEntries(outputs.filter((_, j) => j !== i)) })}>
                        ×
                      </button>
                      {!groups.includes(name) && <span className="col-span-full text-error">{t("noPart", { name })}</span>}
                    </div>
                  ))}
                  <Options id={unitsId} values={UNITS} />
                  <button
                    type="button"
                    className={cn(linkButton, "self-start")}
                    onClick={() => {
                      const name = groups.find((g) => !(g in x.outputs)) ?? `out${outputs.length + 1}`;
                      set({ ...x, outputs: { ...x.outputs, [name]: { target: "term" } } });
                    }}
                  >
                    {t("addValue")}
                  </button>
                </div>
              </Section>
              <details className="flex flex-col gap-4">
                <summary className="cursor-pointer">
                  {t("more")} <span className="text-muted-foreground">{t("moreSummary")}</span>
                </summary>
                <div className="pt-2">
                  <Section title={t("labels")}>
                    <Field label={t("note")} wide>
                      <TextArea value={x.note} onChange={(v) => set(put(x, "note", v))} rows={2} />
                    </Field>
                    <Field label={t("id")}>
                      <Text mono value={x.id} onChange={(v) => set({ ...x, id: v ?? "" })} optional={false} />
                    </Field>
                  </Section>
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
