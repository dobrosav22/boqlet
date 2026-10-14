/**
 * Classification editor (input 3): the code list (a tree of codes) and the map that gives
 * BoQ lines their codes. Classification only labels lines; nothing here changes a number.
 *
 * Three tabs, like the rule-set editor:
 *   Codes per line  one code per BoQ item (ClassTable), with what else decides each row's code
 *   Code list       the codes, and about the list (publisher, licence, levels)
 *   Advanced        rules by condition, where codes come from and what happens when none fits, JSON
 * Above them, the classification in a few sentences (classStory.tsx).
 */
import { useEffect, useId, useMemo, useState } from "react";
import type { ClassificationMap, Code, CodeList, CodeTarget, LineMatch, MapRule, PresetsResponse, RuleSet } from "@ifc-boq/types";
import { LINE_FIELDS, MANUAL_KINDS } from "./vocab";
import { Check, ExprInput, Field, LazyText, LogicTree, Num, Options, RowList, Section, Select, StringList, Text, TextArea, matches, type RowInfo } from "./fields";
import { JsonTab } from "./JsonTab";
import { CodeImport } from "./CodeImport";
import { ClassTable, CodePicker, readTable, type RuleSetOption } from "./ClassTable";
import { ClassStory, codeWords, lineKinds, matchWords, type LineKind } from "./classStory";
import { move, put, removeAt, replaceAt, uniqueId, type ClassificationDoc } from "./store";

type Tab = "table" | "codes" | "advanced";
type AdvancedTab = "rules" | "settings" | "json";

export function ClassificationEditor({ doc, onChange, presets, ruleSets, loadRuleSet }: {
  doc: ClassificationDoc;
  onChange: (d: ClassificationDoc) => void;
  presets: PresetsResponse | null;
  ruleSets: RuleSetOption[];
  loadRuleSet: (id: string) => Promise<RuleSet | null>;
}) {
  // an empty code list has nothing to map yet: start where the codes come in
  const [tab, setTab] = useState<Tab>(doc.codeList.codes.length ? "table" : "codes");
  const [advanced, setAdvanced] = useState<AdvancedTab>("rules");
  /** Map rule to select when the rules list opens (from a "rule …" link under a table row). */
  const [focus, setFocus] = useState<number | null>(null);
  const { codeList, map } = doc;
  const setList = (cl: CodeList) => onChange({ ...doc, codeList: cl });
  const setMap = (m: ClassificationMap) => onChange({ ...doc, map: m });
  const titles = useMemo(() => new Map(codeList.codes.map((c) => [c.code, c.title])), [codeList]);
  const usage = codeUsage(map);
  const { used: table } = readTable(map);

  // the BoQ items whose lines get codes: the table's rows, and names for rules aimed at items
  const [rsId, setRsId] = useState(ruleSets.some((r) => r.id === "as-modelled") ? "as-modelled" : ruleSets[0]?.id);
  const [rs, setRs] = useState<RuleSet | null>(null);
  const [rsError, setRsError] = useState<string | null>(null);
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
  const kinds = useMemo(() => (rs ? lineKinds(rs) : null), [rs]);
  const itemLabel = (id: string) => kinds?.find((k) => k.id === id)?.label ?? id;

  const openRule = (i: number) => {
    setFocus(i);
    setTab("advanced");
    setAdvanced("rules");
  };
  const jump = (to: "table" | "codes" | "rules" | "settings") => {
    if (to === "rules" || to === "settings") {
      setTab("advanced");
      setAdvanced(to);
    } else setTab(to);
  };

  const tabs: [Tab, string][] = [
    ["table", "Codes per line"],
    ["codes", `Code list (${codeList.codes.length})`],
    ["advanced", "Advanced"],
  ];
  const advancedTabs: [AdvancedTab, string][] = [
    ["rules", `Rules by condition (${map.rules.length - table.size})`],
    ["settings", "Where codes come from"],
    ["json", "JSON"],
  ];
  return (
    <>
      <ClassStory codeList={codeList} map={map} table={table} kinds={kinds} ruleSetName={ruleSets.find((r) => r.id === rsId)?.name} onJump={jump} />
      <nav className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "tab active" : "tab"} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="panel">
        {tab === "table" && (
          <ClassTable codeList={codeList} map={map} onChange={setMap} presets={presets} ruleSets={ruleSets} rsId={rsId} setRsId={setRsId} kinds={kinds} rsError={rsError} onOpenRule={openRule} />
        )}
        {tab === "codes" && <CodesTab list={codeList} onChange={setList} usage={usage} onRenameId={(v) => onChange({ codeList: { ...codeList, id: v }, map: { ...map, codeList: v } })} />}
        {tab === "advanced" && (
          <>
            <div className="seg adv-nav" role="tablist">
              {advancedTabs.map(([id, label]) => (
                <button key={id} role="tab" aria-selected={advanced === id} className={advanced === id ? "on" : ""} onClick={() => setAdvanced(id)}>
                  {label}
                </button>
              ))}
            </div>
            {advanced === "rules" && <MapTab key={focus ?? ""} map={map} onChange={setMap} titles={titles} table={table} initial={focus} kinds={kinds ?? []} itemLabel={itemLabel} onTable={() => setTab("table")} />}
            {advanced === "settings" && <MapSettings doc={doc} onChange={onChange} titles={titles} />}
            {advanced === "json" && <JsonTab value={doc} onChange={onChange} note="The code list and the map, as two files: presets/classifications/<id>/codelist.json and map.json." />}
          </>
        )}
      </div>
    </>
  );
}

/* ================================================================ codes */

const parentOf = (c: Code, sep: string | undefined, known: Set<string>) => {
  if (c.parent) return c.parent;
  if (!sep || !c.code.includes(sep)) return undefined;
  const p = c.code.slice(0, c.code.lastIndexOf(sep));
  return known.has(p) ? p : undefined;
};

function codeUsage(map: ClassificationMap): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of map.rules) for (const c of new Set(targetCodes(r.code))) (out[c] ??= []).push(r.id);
  return out;
}
const targetCodes = (t: CodeTarget): string[] =>
  typeof t === "string" ? [t] : "table" in t ? [...Object.values(t.table), ...(t.default ? [t.default] : [])] : [];

function CodesTab({ list, onChange, usage, onRenameId }: { list: CodeList; onChange: (cl: CodeList) => void; usage: Record<string, string[]>; onRenameId: (id: string) => void }) {
  const [q, setQ] = useState("");
  const codes = list.codes;
  const [importing, setImporting] = useState(codes.length === 0);
  const known = new Set(codes.map((c) => c.code));
  const sep = list.separator;
  const setCodes = (c: Code[]) => onChange({ ...list, codes: c });

  // Depth-first order with depth, so the list reads as a tree.
  const ordered: { c: Code; i: number; depth: number }[] = [];
  const kids = (p: string | undefined) => codes.map((c, i) => ({ c, i })).filter(({ c }) => parentOf(c, sep, known) === p);
  const walk = (p: string | undefined, depth: number) => {
    for (const k of kids(p)) {
      ordered.push({ ...k, depth });
      walk(k.c.code, depth + 1);
    }
  };
  walk(undefined, 0);
  const shown = ordered.filter(({ c }) => matches(q, c.code, c.title));

  const addChild = (parent?: string) => {
    const siblings = codes.filter((c) => parentOf(c, sep, known) === parent).length;
    const suffix = String(siblings + 1).padStart(2, "0");
    const code = uniqueId(parent ? `${parent}${sep ?? "."}${suffix}` : String.fromCharCode(65 + Math.min(siblings, 25)), known);
    const c: Code = parent && !sep ? { code, title: "New code", parent } : { code, title: "New code" };
    setCodes([...codes, c]);
  };
  const rename = (i: number, code: string) => {
    const old = codes[i].code;
    setCodes(codes.map((c, j) => (j === i ? { ...c, code } : c.parent === old ? { ...c, parent: code } : c)));
  };
  if (importing)
    return (
      <CodeImport
        list={list}
        onImport={(cl) => {
          onChange(cl);
          setImporting(false);
        }}
        onCancel={() => setImporting(false)}
      />
    );

  return (
    <>
      <p className="hint">
        The codes lines can get, as a tree. {sep ? `Parents follow from the separator “${sep}” (B.01 is under B)` : "Parents are set explicitly"}. In the BoQ, lines are grouped under these codes
        and their parents, with subtotals.
      </p>
      <AboutList list={list} onChange={onChange} onRenameId={onRenameId} />
      <div className="ld-tools">
        <input type="search" placeholder="Filter codes" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="ghost small-btn" onClick={() => addChild()}>
          + Top-level code
        </button>
        <button type="button" className="ghost small-btn" onClick={() => setImporting(true)}>
          Import from Excel or CSV
        </button>
      </div>
      <div className="codes">
        <div className="code-row code-head">
          <span>Code</span>
          <span>Title</span>
          <span>Given by rules</span>
          <span />
        </div>
        {shown.length === 0 && <p className="muted small">No codes yet. Add one, or import them from an Excel or CSV file.</p>}
        {shown.map(({ c, i, depth }) => (
          <div key={i} className={`code-row ${depth === 0 ? "top" : ""}`}>
            <span style={{ paddingLeft: depth * 18 }}>
              <LazyText mono value={c.code} onCommit={(v) => v.trim() && rename(i, v.trim())} />
            </span>
            <span>
              <LazyText value={c.title} onCommit={(v) => setCodes(replaceAt(codes, i, { ...c, title: v }))} />
            </span>
            <span className="small">{usage[c.code]?.join(", ") ?? <span className="muted">—</span>}</span>
            <span className="code-actions">
              <button type="button" className="link small" onClick={() => addChild(c.code)}>
                + child
              </button>
              <button type="button" className="icon" aria-label={`Delete ${c.code}`} onClick={() => setCodes(removeAt(codes, i))}>
                ×
              </button>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/** Name, publisher, levels, licence: folded, as they are set once. */
function AboutList({ list: cl, onChange: setCl, onRenameId }: { list: CodeList; onChange: (cl: CodeList) => void; onRenameId: (id: string) => void }) {
  const lic = cl.licence;
  return (
    <details className="more-opts about-list">
      <summary>
        About this list{" "}
        <span className="muted small">
          · {[cl.kind, cl.publisher, cl.version, cl.levels?.length ? `levels: ${cl.levels.join(" › ")}` : "", lic ? `licence: ${lic.name}` : ""].filter(Boolean).join(" · ")}
        </span>
      </summary>
      <Section title="The list">
        <Field label="Name">
          <Text value={cl.name} onChange={(v) => setCl({ ...cl, name: v ?? "" })} optional={false} />
        </Field>
        <Field label="Kind">
          <Select value={cl.kind} options={["official", "company", "client", "other"] as const} labels={{ official: "official (Uniclass, OmniClass…)", company: "our company's own", client: "a client's", other: "other" }} onChange={(v) => setCl({ ...cl, kind: v ?? "company" })} />
        </Field>
        <Field label="Publisher">
          <Text value={cl.publisher} onChange={(v) => setCl(put(cl, "publisher", v))} />
        </Field>
        <Field label="Version">
          <Text value={cl.version} onChange={(v) => setCl(put(cl, "version", v))} />
        </Field>
        <Field label="Language">
          <Text value={cl.locale} onChange={(v) => setCl(put(cl, "locale", v))} placeholder="en" />
        </Field>
        <Field label="Code separator" hint="Gives each code its parent: with “.”, B.01 is under B.">
          <Text mono value={cl.separator} onChange={(v) => setCl(put(cl, "separator", v))} placeholder="(none)" />
        </Field>
        <Field label="Names of the levels" group hint="Top first, e.g. Section, Item.">
          <StringList values={cl.levels} onChange={(v) => setCl(put(cl, "levels", v))} placeholder="Section, Item…" />
        </Field>
        <Field label="Id" hint="Also the folder: presets/classifications/<id>/">
          <Text mono value={cl.id} onChange={(v) => onRenameId(v ?? "")} optional={false} />
        </Field>
      </Section>
      <Section title="Licence" hint="Official lists often may not be passed on. Company and client lists are your own data.">
        {lic ? (
          <>
            <Field label="Licence">
              <Text value={lic.name} onChange={(v) => setCl({ ...cl, licence: { ...lic, name: v ?? "" } })} optional={false} />
            </Field>
            <Field label="URL">
              <Text value={lic.url} onChange={(v) => setCl({ ...cl, licence: put(lic, "url", v) })} />
            </Field>
            <Field label="Attribution">
              <Text value={lic.attribution} onChange={(v) => setCl({ ...cl, licence: put(lic, "attribution", v) })} />
            </Field>
            <Field label="Passing it on" group>
              <Check checked={lic.redistributable} onChange={(v) => setCl({ ...cl, licence: { ...lic, redistributable: v } })} label="may be shipped to other organisations" />
            </Field>
          </>
        ) : (
          <Field label="Licence" group>
            <button type="button" className="link small" onClick={() => setCl({ ...cl, licence: { name: "Internal", redistributable: false } })}>
              Add licence details
            </button>
          </Field>
        )}
      </Section>
    </details>
  );
}

/* ================================================================ rules by condition */

type LeafKind = "ruleId" | "tag" | "manualKind" | "where";
const LEAF_LABEL: Record<LeafKind, string> = {
  ruleId: "Lines of BoQ items",
  tag: "Lines of items tagged",
  manualKind: "Lines entered by hand, of kind",
  where: "Lines where (a condition)",
};
const leafKind = (m: LineMatch): LeafKind => ("ruleId" in m ? "ruleId" : "tag" in m ? "tag" : "manualKind" in m ? "manualKind" : "where");
const asList = (v: string | string[]) => (Array.isArray(v) ? v : [v]);
const oneOrMany = (l: string[] | undefined) => (!l || l.length === 0 ? "" : l.length === 1 ? l[0] : l);

function MatchLeaf({ value, onChange, kinds, itemLabel }: { value: LineMatch; onChange: (v: LineMatch) => void; kinds: LineKind[]; itemLabel: (id: string) => string }) {
  const kind = leafKind(value);
  const templates: Record<LeafKind, LineMatch> = { ruleId: { ruleId: "" }, tag: { tag: "" }, manualKind: { manualKind: "preliminary" }, where: { where: "" } };
  const tags = [...new Set(kinds.flatMap((k) => k.tags))].sort();
  return (
    <div className="leaf">
      <select value={kind} onChange={(e) => onChange(templates[e.target.value as LeafKind])} aria-label="Condition type">
        {(Object.keys(LEAF_LABEL) as LeafKind[]).map((k) => (
          <option key={k} value={k}>
            {LEAF_LABEL[k]}
          </option>
        ))}
      </select>
      {"ruleId" in value && <ItemsPicker ids={asList(value.ruleId).filter(Boolean)} onChange={(v) => onChange({ ruleId: oneOrMany(v) })} kinds={kinds} itemLabel={itemLabel} />}
      {"tag" in value && <StringList values={asList(value.tag).filter(Boolean)} onChange={(v) => onChange({ tag: oneOrMany(v) })} suggestions={tags} placeholder="wall, finish, formwork…" />}
      {"manualKind" in value && <StringList values={asList(value.manualKind).filter(Boolean)} onChange={(v) => onChange({ manualKind: oneOrMany(v) })} suggestions={MANUAL_KINDS} />}
      {"where" in value && (
        <ExprInput value={value.where} onChange={(v) => onChange({ where: v ?? "" })} placeholder='ifc_class = "IfcWall" AND UNDER(element_type, "wall.partition")' />
      )}
    </div>
  );
}

/** BoQ items by name, as chips, with a select to add one. */
function ItemsPicker({ ids, onChange, kinds, itemLabel }: { ids: string[]; onChange: (ids: string[]) => void; kinds: LineKind[]; itemLabel: (id: string) => string }) {
  return (
    <div className="slist">
      {ids.map((id) => (
        <span key={id} className="chip" title={id}>
          {itemLabel(id)}
          <button type="button" className="chip-x" aria-label={`Remove ${itemLabel(id)}`} onClick={() => onChange(ids.filter((x) => x !== id))}>
            ×
          </button>
        </span>
      ))}
      <select className="class-pick" value="" onChange={(e) => e.target.value && onChange([...ids, e.target.value])} aria-label="Add a BoQ item">
        <option value="">{ids.length ? "+ another item…" : "+ pick a BoQ item…"}</option>
        {kinds
          .filter((k) => !ids.includes(k.id))
          .map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
      </select>
    </div>
  );
}

function TargetEditor({ value, onChange, titles }: { value: CodeTarget; onChange: (v: CodeTarget) => void; titles: Map<string, string> }) {
  const mode = typeof value === "string" ? "fixed" : "fromSource" in value ? "source" : "lookup";
  const fieldsId = useId();
  return (
    <>
      <Field label="The code is">
        <Select
          value={mode}
          options={["fixed", "lookup", "source"] as const}
          labels={{ fixed: "one code", lookup: "looked up from a value of the line", source: "the code of the line it is calculated from" }}
          onChange={(m) => onChange(m === "lookup" ? { lookup: "material", table: {} } : m === "source" ? { fromSource: true } : "")}
        />
      </Field>
      {typeof value === "string" && (
        <Field label="Code" group>
          <CodePicker value={value} onChange={(v) => onChange(v ?? "")} titles={titles} />
        </Field>
      )}
      {typeof value === "object" && "fromSource" in value && <p className="hint f-wide">Formwork, paint and other calculated lines take the code of the line they were calculated from.</p>}
      {typeof value === "object" && "table" in value && (
        <>
          <Field label="Look up the line's">
            <Text mono list={fieldsId} value={value.lookup} onChange={(v) => onChange({ ...value, lookup: v ?? "" })} optional={false} />
            <Options id={fieldsId} values={LINE_FIELDS} />
          </Field>
          <Field label="When the value is not in the table">
            <CodePicker value={value.default} onChange={(v) => onChange(put(value, "default", v))} titles={titles} />
          </Field>
          <div className="f-wide">
            <span className="f-label">Value → code</span>
            {Object.entries(value.table).map(([k, code], i, all) => (
              <div key={i} className="kv-row three">
                <LazyText mono value={k} onCommit={(nk) => onChange({ ...value, table: Object.fromEntries(all.map((r, j) => (j === i ? [nk, r[1]] : r))) })} />
                <CodePicker value={code} onChange={(c) => onChange({ ...value, table: { ...value.table, [k]: c ?? "" } })} titles={titles} />
                <button type="button" className="icon" aria-label={`Remove ${k}`} onClick={() => onChange({ ...value, table: Object.fromEntries(all.filter((_, j) => j !== i)) })}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="link small" onClick={() => onChange({ ...value, table: { ...value.table, [`value${Object.keys(value.table).length + 1}`]: "" } })}>
              + Row
            </button>
          </div>
        </>
      )}
    </>
  );
}

const shortCode = (t: CodeTarget, titles: Map<string, string>) =>
  typeof t === "string" ? `${t} ${titles.get(t) ?? ""}`.trim() || "(no code)" : "fromSource" in t ? "code of the source line" : `looked up by ${t.lookup.replace(/_/g, " ")}`;

function MapTab({ map, onChange, titles, table, initial, kinds, itemLabel, onTable }: {
  map: ClassificationMap;
  onChange: (m: ClassificationMap) => void;
  titles: Map<string, string>;
  /** Indexes of the rules the Codes per line table writes. */
  table: Set<number>;
  initial: number | null;
  kinds: LineKind[];
  itemLabel: (id: string) => string;
  onTable: () => void;
}) {
  const rules = map.rules;
  const firstOwn = rules.findIndex((_, i) => !table.has(i));
  const [sel, setSel] = useState<number | null>(initial ?? (firstOwn >= 0 ? firstOwn : null));
  const [q, setQ] = useState("");
  const setRules = (r: MapRule[]) => onChange({ ...map, rules: r });
  const rule = sel !== null ? rules[sel] : undefined;
  const set = (r: MapRule) => setRules(replaceAt(rules, sel!, r));
  const fromTable = sel !== null && table.has(sel);
  const row = (r: MapRule, i: number): RowInfo => ({
    key: String(i),
    title: shortCode(r.code, titles),
    sub: `${matchWords(r.match, itemLabel)}${r.priority ? ` · priority ${r.priority}` : ""}`,
    badge: targetCodes(r.code).some((c) => c && !titles.has(c)) ? { text: "unknown code", tone: "removed" as const } : undefined,
  });
  const shown = rules.map((r, i) => ({ r, i })).filter(({ r }) => matches(q, r.id, matchWords(r.match, itemLabel), shortCode(r.code, titles)));
  const rows: RowInfo[] = [
    ...shown.filter(({ i }) => !table.has(i)).map(({ r, i }) => ({ ...row(r, i), section: "Rules by condition" })),
    ...shown.filter(({ i }) => table.has(i)).map(({ r, i }) => ({ ...row(r, i), section: "Written by the Codes per line table" })),
  ];

  return (
    <>
      <p className="hint">
        Rules for what one code per BoQ item cannot say: lines of items with a tag, lines whose material or element type is something, hand-entered lines of a kind. When several rules give
        a line a code, the higher priority wins (table rows have 5, split rows 6); between equal priorities the one higher in this list wins
        {map.onConflict === "ask" ? ", or the line is asked about" : ""}.
      </p>
      <div className="ld">
        <RowList
          rows={rows}
          selected={sel === null ? null : String(sel)}
          onSelect={(k) => setSel(Number(k))}
          onAdd={() => {
            setRules([...rules, { id: uniqueId("rule", rules.map((r) => r.id)), match: { ruleId: "" }, code: "" }]);
            setSel(rules.length);
          }}
          addLabel="+ New rule"
          filter={q}
          onFilter={setQ}
          empty="No rules yet."
        />
        <div className="ld-detail">
          {!rule && <p className="muted">Select a rule, or add one.</p>}
          {rule && (
            <>
              <div className="ld-actions">
                {fromTable ? (
                  <>
                    <span className="muted small">Written by the Codes per line table; change it there.</span>
                    <button type="button" className="ghost small-btn" onClick={onTable}>
                      Open the table
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="ghost small-btn" disabled={sel === 0} onClick={() => (setRules(move(rules, sel!, -1)), setSel(sel! - 1))}>
                      Move up
                    </button>
                    <button type="button" className="ghost small-btn" disabled={sel === rules.length - 1} onClick={() => (setRules(move(rules, sel!, 1)), setSel(sel! + 1))}>
                      Move down
                    </button>
                    <button
                      type="button"
                      className="ghost small-btn danger"
                      onClick={() => {
                        setRules(removeAt(rules, sel!));
                        setSel(null);
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
              <div className="story">
                <p>
                  {cap(matchWords(rule.match, itemLabel))} get <b>{codeWords(rule.code, titles)}</b>.
                </p>
                <p className="story-meta">
                  Priority {rule.priority ?? 0}: {(rule.priority ?? 0) >= 5 ? "wins over the table's rows" : "the table's rows (priority 5 and 6) win over it"}
                  {rule.note ? `. ${rule.note}` : "."}
                </p>
              </div>
              <fieldset className="ro" disabled={fromTable}>
                <div className="form">
                  <Section title="1 · Which lines">
                    <div className="f-wide">
                      <LogicTree<LineMatch>
                        value={rule.match}
                        onChange={(m) => set({ ...rule, match: m })}
                        newLeaf={() => ({ where: "" })}
                        renderLeaf={(l, s) => <MatchLeaf value={l} onChange={s} kinds={kinds} itemLabel={itemLabel} />}
                      />
                    </div>
                    <p className="hint f-wide">
                      A condition can use the line's values: material, element type (dictionary terms, with “is a kind of”: UNDER(material, "concrete")), ifc_class, storey, storey_elevation,
                      unit, tags, and keys.&lt;what the line is split by&gt;, e.g. keys.type_name.
                    </p>
                  </Section>
                  <Section title="2 · Which code">
                    <TargetEditor value={rule.code} onChange={(c) => set({ ...rule, code: c })} titles={titles} />
                  </Section>
                  <Section title="3 · When several rules apply">
                    <Field label="Priority" hint="Higher wins. Table rows have 5, split rows 6; give 7 or more to win over the table.">
                      <Num value={rule.priority} onChange={(v) => set(put(rule, "priority", v))} step={1} placeholder="0" />
                    </Field>
                  </Section>
                  <details className="more-opts">
                    <summary>More options</summary>
                    <Section title="Labels">
                      <Field label="Note" wide>
                        <TextArea value={rule.note} onChange={(v) => set(put(rule, "note", v))} rows={2} />
                      </Field>
                      <Field label="Id">
                        <Text mono value={rule.id} onChange={(v) => set({ ...rule, id: v ?? "" })} optional={false} />
                      </Field>
                    </Section>
                  </details>
                </div>
              </fieldset>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* ================================================================ where codes come from */

const SOURCES = ["decision", "map", "ifc"] as const;
const SOURCE_LABEL = {
  decision: "your answer for the project (when a line was asked about)",
  map: "this classification's rules (the table and the rules by condition)",
  ifc: "a code already on the elements in the IFC",
};

function MapSettings({ doc, onChange, titles }: { doc: ClassificationDoc; onChange: (d: ClassificationDoc) => void; titles: Map<string, string> }) {
  const { map } = doc;
  const setMap = (m: ClassificationMap) => onChange({ ...doc, map: m });
  const sources = map.sources ?? ["decision", "map"];
  const unmapped = typeof map.onUnmapped === "string" ? map.onUnmapped : "code";
  return (
    <div className="form">
      <Section title="A line's code comes from, in this order" hint="The first that gives a code wins.">
        <div className="f-wide">
          <ol className="order">
            {sources.map((s, i) => (
              <li key={s}>
                <span>{SOURCE_LABEL[s]}</span>
                <button type="button" className="icon" aria-label="Earlier" disabled={i === 0} onClick={() => setMap({ ...map, sources: move(sources, i, -1) })}>
                  ↑
                </button>
                <button type="button" className="icon" aria-label="Later" disabled={i === sources.length - 1} onClick={() => setMap({ ...map, sources: move(sources, i, 1) })}>
                  ↓
                </button>
                <button type="button" className="icon" aria-label={`Do not use ${SOURCE_LABEL[s]}`} disabled={sources.length === 1} onClick={() => setMap({ ...map, sources: sources.filter((x) => x !== s) })}>
                  ×
                </button>
              </li>
            ))}
          </ol>
          {SOURCES.filter((s) => !sources.includes(s)).map((s) => (
            <button key={s} type="button" className="link small" onClick={() => setMap({ ...map, sources: [...sources, s] })}>
              + {SOURCE_LABEL[s]}
            </button>
          ))}
        </div>
        {sources.includes("ifc") && (
          <>
            <Field label="Classification names in the IFC" group hint="An IfcClassification with one of these names counts as this list, e.g. Uniclass 2015.">
              <StringList values={map.ifc?.systemNames} onChange={(v) => setMap({ ...map, ifc: { agreement: map.ifc?.agreement ?? "majority", systemNames: v ?? [] } })} />
            </Field>
            <Field label="When a line's elements carry different codes">
              <Select
                value={map.ifc?.agreement}
                options={["all", "majority", "ask"] as const}
                labels={{ all: "use it only if all agree", majority: "use the most common one", ask: "ask" }}
                onChange={(v) => setMap({ ...map, ifc: { systemNames: map.ifc?.systemNames ?? [], agreement: v ?? "majority" } })}
              />
            </Field>
          </>
        )}
      </Section>
      <Section title="When nothing gives a code">
        <Field label="The line">
          <Select
            value={unmapped}
            options={["flag", "ask", "code"] as const}
            labels={{ flag: "stays without a code", ask: "is asked about (does not block the BoQ)", code: "gets a default code" }}
            onChange={(v) => setMap({ ...map, onUnmapped: v === "code" ? { code: titles.keys().next().value ?? "" } : (v ?? "flag") })}
          />
        </Field>
        {typeof map.onUnmapped === "object" && (
          <Field label="Default code" group>
            <CodePicker value={map.onUnmapped.code} onChange={(c) => setMap({ ...map, onUnmapped: { code: c ?? "" } })} titles={titles} />
          </Field>
        )}
        <Field label="When rules of equal priority disagree">
          <Select value={map.onConflict} options={["first", "ask"] as const} labels={{ first: "the one higher in the list wins", ask: "ask" }} onChange={(v) => setMap({ ...map, onConflict: v ?? "first" })} />
        </Field>
      </Section>
      <details className="more-opts">
        <summary>About this map</summary>
        <Section title="The map" hint="The map is the rules; the code list is the codes. Saved together, as map.json next to codelist.json.">
          <Field label="Name">
            <Text value={map.name} onChange={(v) => setMap({ ...map, name: v ?? "" })} optional={false} />
          </Field>
          <Field label="Id">
            <Text mono value={map.id} onChange={(v) => setMap({ ...map, id: v ?? "" })} optional={false} />
          </Field>
          <Field label="Version">
            <Text value={map.version} onChange={(v) => setMap({ ...map, version: v ?? "" })} optional={false} />
          </Field>
          <Field label="Based on map" hint="Takes another map's rules; rules here replace them by id.">
            <Text mono value={map.extends} onChange={(v) => setMap(put(map, "extends", v))} placeholder="(none)" />
          </Field>
        </Section>
      </details>
    </div>
  );
}
