/**
 * Classification editor (input 3): the code list (a tree of codes) and the map that gives
 * BoQ lines their codes. Classification only labels lines; nothing here changes a number.
 */
import { useId, useState } from "react";
import type { ClassificationMap, Code, CodeList, CodeTarget, LineMatch, MapRule, PresetsResponse, RuleSet } from "@ifc-boq/types";
import { LINE_FIELDS, MANUAL_KINDS } from "./vocab";
import { Check, ExprInput, Field, LazyText, LogicTree, Num, Options, RowList, Section, Select, StringList, Text, TextArea, matches, type RowInfo } from "./fields";
import { JsonTab } from "./JsonTab";
import { CodeImport } from "./CodeImport";
import { ClassTable, CodePicker, type RuleSetOption } from "./ClassTable";
import { move, put, removeAt, replaceAt, uniqueId, type ClassificationDoc } from "./store";

type Tab = "table" | "overview" | "codes" | "map" | "json";

export function ClassificationEditor({ doc, onChange, presets, ruleSets, loadRuleSet }: {
  doc: ClassificationDoc;
  onChange: (d: ClassificationDoc) => void;
  presets: PresetsResponse | null;
  ruleSets: RuleSetOption[];
  loadRuleSet: (id: string) => Promise<RuleSet | null>;
}) {
  // an empty code list has nothing to map yet: start where the codes come in
  const [tab, setTab] = useState<Tab>(doc.codeList.codes.length ? "table" : "codes");
  const { codeList, map } = doc;
  const setList = (cl: CodeList) => onChange({ ...doc, codeList: cl });
  const setMap = (m: ClassificationMap) => onChange({ ...doc, map: m });
  const titles = new Map(codeList.codes.map((c) => [c.code, c.title]));
  const usage = codeUsage(map);

  const tabs: [Tab, string][] = [
    ["table", "Codes per line"],
    ["overview", "Overview"],
    ["codes", `Code list (${codeList.codes.length})`],
    ["map", `Advanced map rules (${map.rules.length})`],
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
        {tab === "table" && (
          <ClassTable codeList={codeList} map={map} onChange={setMap} presets={presets} ruleSets={ruleSets} loadRuleSet={loadRuleSet} onAdvanced={() => setTab("map")} />
        )}
        {tab === "overview" && <Overview doc={doc} onChange={onChange} titles={titles} />}
        {tab === "codes" && <CodesTab list={codeList} onChange={setList} usage={usage} />}
        {tab === "map" && <MapTab map={map} onChange={setMap} titles={titles} />}
        {tab === "json" && <JsonTab value={doc} onChange={onChange} note="The code list and the map, as two files: presets/classifications/<id>/codelist.json and map.json." />}
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

function CodesTab({ list, onChange, usage }: { list: CodeList; onChange: (cl: CodeList) => void; usage: Record<string, string[]> }) {
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
        The codes and their hierarchy. {sep ? `Parents follow from the separator “${sep}” (B.01 is under B)` : "Parents are set explicitly"}. A map rule then gives each BoQ line one of these codes.
      </p>
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
          <span>Used by map rules</span>
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

/* ================================================================ map */

type LeafKind = "ruleId" | "tag" | "manualKind" | "where";
const LEAF_LABEL: Record<LeafKind, string> = { ruleId: "Rule id is", tag: "Has tag", manualKind: "Manual item kind", where: "Expression" };
const leafKind = (m: LineMatch): LeafKind => ("ruleId" in m ? "ruleId" : "tag" in m ? "tag" : "manualKind" in m ? "manualKind" : "where");
const asList = (v: string | string[]) => (Array.isArray(v) ? v : [v]);
const oneOrMany = (l: string[] | undefined) => (!l || l.length === 0 ? "" : l.length === 1 ? l[0] : l);

function MatchLeaf({ value, onChange }: { value: LineMatch; onChange: (v: LineMatch) => void }) {
  const kind = leafKind(value);
  const templates: Record<LeafKind, LineMatch> = { ruleId: { ruleId: "" }, tag: { tag: "" }, manualKind: { manualKind: "preliminary" }, where: { where: "" } };
  return (
    <div className="leaf">
      <select value={kind} onChange={(e) => onChange(templates[e.target.value as LeafKind])} aria-label="Condition type">
        {(Object.keys(LEAF_LABEL) as LeafKind[]).map((k) => (
          <option key={k} value={k}>
            {LEAF_LABEL[k]}
          </option>
        ))}
      </select>
      {"ruleId" in value && <StringList mono values={asList(value.ruleId).filter(Boolean)} onChange={(v) => onChange({ ruleId: oneOrMany(v) })} placeholder="walls, footings…" />}
      {"tag" in value && <StringList values={asList(value.tag).filter(Boolean)} onChange={(v) => onChange({ tag: oneOrMany(v) })} placeholder="finish, formwork…" />}
      {"manualKind" in value && <StringList values={asList(value.manualKind).filter(Boolean)} onChange={(v) => onChange({ manualKind: oneOrMany(v) })} suggestions={MANUAL_KINDS} />}
      {"where" in value && <ExprInput value={value.where} onChange={(v) => onChange({ where: v ?? "" })} placeholder='ifc_class = "IfcWall" AND UNDER(element_type, "wall.partition")' />}
    </div>
  );
}

function describeMatch(m: LineMatch): string {
  if ("all" in m) return m.all.map(describeMatch).join(" and ");
  if ("any" in m) return m.any.map(describeMatch).join(" or ");
  if ("not" in m) return `not (${describeMatch(m.not)})`;
  if ("ruleId" in m) return `rule ${asList(m.ruleId).join("/")}`;
  if ("tag" in m) return `tag ${asList(m.tag).join("/")}`;
  if ("manualKind" in m) return asList(m.manualKind).join("/").replace(/_/g, " ");
  return m.where;
}

function TargetEditor({ value, onChange, titles }: { value: CodeTarget; onChange: (v: CodeTarget) => void; titles: Map<string, string> }) {
  const mode = typeof value === "string" ? "fixed" : "fromSource" in value ? "source" : "lookup";
  const fieldsId = useId();
  return (
    <>
      <Field label="Code comes from">
        <Select
          value={mode}
          options={["fixed", "lookup", "source"] as const}
          labels={{ fixed: "a fixed code", lookup: "a lookup table on a line field", source: "the source line (derived lines)" }}
          onChange={(m) => onChange(m === "lookup" ? { lookup: "material", table: {} } : m === "source" ? { fromSource: true } : "")}
        />
      </Field>
      {typeof value === "string" && (
        <Field label="Code" group>
          <CodePicker value={value} onChange={(v) => onChange(v ?? "")} titles={titles} />
        </Field>
      )}
      {typeof value === "object" && "fromSource" in value && <p className="hint f-wide">Formwork, paint and other derived lines take the code of the line they were derived from.</p>}
      {typeof value === "object" && "table" in value && (
        <>
          <Field label="Look up line field">
            <Text mono list={fieldsId} value={value.lookup} onChange={(v) => onChange({ ...value, lookup: v ?? "" })} optional={false} />
            <Options id={fieldsId} values={LINE_FIELDS} />
          </Field>
          <Field label="Otherwise">
            <CodePicker value={value.default} onChange={(v) => onChange(put(value, "default", v))} titles={titles} />
          </Field>
          <div className="f-wide">
            <span className="f-label">Table: field value → code</span>
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

function describeTarget(t: CodeTarget, titles: Map<string, string>) {
  if (typeof t === "string") return `${t} ${titles.get(t) ?? ""}`.trim();
  if ("fromSource" in t) return "code of the source line";
  return `by ${t.lookup} (${Object.keys(t.table).length} values)`;
}

function MapTab({ map, onChange, titles }: { map: ClassificationMap; onChange: (m: ClassificationMap) => void; titles: Map<string, string> }) {
  const [sel, setSel] = useState<number | null>(map.rules.length ? 0 : null);
  const [q, setQ] = useState("");
  const rules = map.rules;
  const setRules = (r: MapRule[]) => onChange({ ...map, rules: r });
  const rule = sel !== null ? rules[sel] : undefined;
  const set = (r: MapRule) => setRules(replaceAt(rules, sel!, r));
  const rows: RowInfo[] = rules
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => matches(q, r.id, describeMatch(r.match), describeTarget(r.code, titles)))
    .map(({ r, i }) => ({
      key: String(i),
      title: `${r.id} → ${describeTarget(r.code, titles)}`,
      sub: `${describeMatch(r.match)}${r.priority ? ` · priority ${r.priority}` : ""}`,
      badge: targetCodes(r.code).some((c) => c && !titles.has(c)) ? { text: "unknown code", tone: "removed" as const } : undefined,
    }));

  return (
    <>
      <p className="hint">
        Each rule matches BoQ lines (by the rule that made them, a tag, or an expression over line fields) and gives them a code. When several match, the highest priority wins; ties go to the first in this list
        {map.onConflict === "ask" ? " or become a question" : ""}.
      </p>
      <div className="ld">
        <RowList
          rows={rows}
          selected={sel === null ? null : String(sel)}
          onSelect={(k) => setSel(Number(k))}
          onAdd={() => {
            setRules([...rules, { id: uniqueId("rule", rules.map((r) => r.id)), match: { tag: "" }, code: titles.keys().next().value ?? "" }]);
            setSel(rules.length);
          }}
          addLabel="+ New map rule"
          filter={q}
          onFilter={setQ}
        />
        <div className="ld-detail">
          {!rule && <p className="muted">Select a map rule.</p>}
          {rule && (
            <>
              <div className="ld-actions">
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
              </div>
              <div className="form">
                <Section title="Lines this rule matches">
                  <div className="f-wide">
                    <LogicTree<LineMatch> value={rule.match} onChange={(m) => set({ ...rule, match: m })} newLeaf={() => ({ tag: "" })} renderLeaf={(l, s) => <MatchLeaf value={l} onChange={s} />} />
                  </div>
                  <p className="hint f-wide">Expression fields: rule_id, rule_kind, manual_kind, tags, unit, source, family, ifc_class, predefined_type, material, element_type, storey, keys.&lt;line key&gt;.</p>
                </Section>
                <Section title="Code given">
                  <TargetEditor value={rule.code} onChange={(c) => set({ ...rule, code: c })} titles={titles} />
                </Section>
                <Section title="Rule">
                  <Field label="Id">
                    <Text mono value={rule.id} onChange={(v) => set({ ...rule, id: v ?? "" })} optional={false} />
                  </Field>
                  <Field label="Priority" hint="Higher wins when several rules match. Default 0.">
                    <Num value={rule.priority} onChange={(v) => set(put(rule, "priority", v))} step={1} placeholder="0" />
                  </Field>
                  <Field label="Note" wide>
                    <TextArea value={rule.note} onChange={(v) => set(put(rule, "note", v))} rows={2} />
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

/* ================================================================ overview */

const SOURCES = ["decision", "map", "ifc"] as const;
const SOURCE_LABEL = { decision: "a user's answer", map: "the map rules", ifc: "codes already in the IFC" };

function Overview({ doc, onChange, titles }: { doc: ClassificationDoc; onChange: (d: ClassificationDoc) => void; titles: Map<string, string> }) {
  const { codeList: cl, map } = doc;
  const setCl = (c: CodeList) => onChange({ ...doc, codeList: c });
  const setMap = (m: ClassificationMap) => onChange({ ...doc, map: m });
  const sources = map.sources ?? ["decision", "map"];
  const unmapped = typeof map.onUnmapped === "string" ? map.onUnmapped : "code";
  return (
    <div className="form">
      <Section title="Code list">
        <Field label="Name">
          <Text value={cl.name} onChange={(v) => setCl({ ...cl, name: v ?? "" })} optional={false} />
        </Field>
        <Field label="Id" hint="Also the folder: presets/classifications/<id>/">
          <Text mono value={cl.id} onChange={(v) => onChange({ codeList: { ...cl, id: v ?? "" }, map: { ...map, codeList: v ?? "" } })} optional={false} />
        </Field>
        <Field label="Kind">
          <Select value={cl.kind} options={["official", "company", "client", "other"] as const} onChange={(v) => setCl({ ...cl, kind: v ?? "company" })} />
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
        <Field label="Code separator" hint="Derives parents from codes: with “.”, B.01 is under B.">
          <Text mono value={cl.separator} onChange={(v) => setCl(put(cl, "separator", v))} placeholder="(none)" />
        </Field>
        <Field label="Level names" group>
          <StringList values={cl.levels} onChange={(v) => setCl(put(cl, "levels", v))} placeholder="Section, Item…" />
        </Field>
      </Section>
      <Section title="Licence" hint="Official lists often may not be redistributed. Company and client lists are your own data.">
        {cl.licence ? (
          <>
            <Field label="Licence">
              <Text value={cl.licence.name} onChange={(v) => setCl({ ...cl, licence: { ...cl.licence!, name: v ?? "" } })} optional={false} />
            </Field>
            <Field label="URL">
              <Text value={cl.licence.url} onChange={(v) => setCl({ ...cl, licence: put(cl.licence!, "url", v) })} />
            </Field>
            <Field label="Attribution">
              <Text value={cl.licence.attribution} onChange={(v) => setCl({ ...cl, licence: put(cl.licence!, "attribution", v) })} />
            </Field>
            <Field label="Redistributable" group>
              <Check checked={cl.licence.redistributable} onChange={(v) => setCl({ ...cl, licence: { ...cl.licence!, redistributable: v } })} label="may be shipped to other organisations" />
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
      <Section title="Map">
        <Field label="Map name">
          <Text value={map.name} onChange={(v) => setMap({ ...map, name: v ?? "" })} optional={false} />
        </Field>
        <Field label="Map id">
          <Text mono value={map.id} onChange={(v) => setMap({ ...map, id: v ?? "" })} optional={false} />
        </Field>
        <Field label="Version">
          <Text value={map.version} onChange={(v) => setMap({ ...map, version: v ?? "" })} optional={false} />
        </Field>
        <Field label="Extends map">
          <Text mono value={map.extends} onChange={(v) => setMap(put(map, "extends", v))} placeholder="(none)" />
        </Field>
        <Field label="Codes come from, in order" group wide>
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
        </Field>
        {sources.includes("ifc") && (
          <>
            <Field label="IFC classification names" group hint="Names of IfcClassification that count as this list.">
              <StringList values={map.ifc?.systemNames} onChange={(v) => setMap({ ...map, ifc: { agreement: map.ifc?.agreement ?? "majority", systemNames: v ?? [] } })} />
            </Field>
            <Field label="When a line's elements disagree">
              <Select value={map.ifc?.agreement} options={["all", "majority", "ask"] as const} onChange={(v) => setMap({ ...map, ifc: { systemNames: map.ifc?.systemNames ?? [], agreement: v ?? "majority" } })} />
            </Field>
          </>
        )}
        <Field label="Line no rule matches">
          <Select
            value={unmapped}
            options={["flag", "ask", "code"] as const}
            labels={{ flag: "leave without a code", ask: "ask the user (non-blocking)", code: "give a default code" }}
            onChange={(v) => setMap({ ...map, onUnmapped: v === "code" ? { code: titles.keys().next().value ?? "" } : (v ?? "flag") })}
          />
        </Field>
        {typeof map.onUnmapped === "object" && (
          <Field label="Default code" group>
            <CodePicker value={map.onUnmapped.code} onChange={(c) => setMap({ ...map, onUnmapped: { code: c ?? "" } })} titles={titles} />
          </Field>
        )}
        <Field label="Several rules with equal priority">
          <Select value={map.onConflict} options={["first", "ask"] as const} labels={{ first: "first rule wins", ask: "ask the user" }} onChange={(v) => setMap({ ...map, onConflict: v ?? "first" })} />
        </Field>
      </Section>
    </div>
  );
}
