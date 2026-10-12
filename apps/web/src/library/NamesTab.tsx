/**
 * "Names in a model": every material and type name a loaded IFC uses, what it means under this
 * dictionary (plus the lower layers it builds on), and a one-click way to give it a term.
 *
 * Assigning writes ordinary entries into this dictionary: an exact match per name, or one
 * "starts with" entry for several similar names, optionally only on some IFC classes. The engine
 * resolves the names (POST /api/models/{id}/names); nothing is matched in the browser.
 */
import { useEffect, useId, useMemo, useState } from "react";
import type { DictField, Dictionary, DictionaryEntry, ModelSummary, NameUse, PresetsResponse } from "@ifc-boq/types";
import { api } from "../api";
import { Options, matches } from "./fields";
import { slug, uniqueId } from "./store";

type KnownTerm = { id: string; label: string; category: string };
type Group = "materials" | "types";
type Status = "all" | "unresolved" | "here" | "elsewhere";

const LAYER_RANK = { global: 0, company: 1, project: 2, decision: 3 } as const;
const MATERIAL_FIELDS: DictField[] = ["material", "layer_material"];

/** One row on screen: material and layer-material uses of the same text are shown together. */
interface Row {
  key: string;
  group: Group;
  raw: string;
  fields: DictField[];
  uses: NameUse[];
  term: string | null;
  count: number;
  classes: string[];
  worthAsking: boolean;
}

function rowsOf(names: NameUse[]): Row[] {
  const out = new Map<string, Row>();
  for (const n of names) {
    const group: Group = MATERIAL_FIELDS.includes(n.field) ? "materials" : "types";
    const key = `${group}|${n.raw}|${n.term ?? ""}`;
    const r = out.get(key) ?? { key, group, raw: n.raw, fields: [], uses: [], term: n.term, count: 0, classes: [], worthAsking: false };
    r.fields = [...new Set([...r.fields, n.field])];
    r.uses.push(n);
    r.count = Math.max(r.count, n.count); // the same elements report a material and its layers
    r.classes = [...new Set([...r.classes, ...n.classes])].sort();
    r.worthAsking ||= n.worthAsking;
    out.set(key, r);
  }
  return [...out.values()];
}

/* ---------------------------------------------------------------- suggestions */

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !/^\d+$/.test(w));

function suggestTerm(raw: string, terms: KnownTerm[]): KnownTerm | null {
  const want = words(raw);
  let best: { t: KnownTerm; score: number } | null = null;
  for (const t of terms) {
    const have = new Set([...words(t.label), ...t.id.split(/[._]/)]);
    const hits = want.filter((w) => [...have].some((h) => h === w || (h.length > 3 && w.startsWith(h)) || (w.length > 3 && h.startsWith(w)))).length;
    if (!hits) continue;
    const score = hits + t.id.split(".").length * 0.01;
    if (!best || score > best.score) best = { t, score };
  }
  return best?.t ?? null;
}

function commonPrefix(list: string[]): string {
  if (list.length < 2) return "";
  let p = list[0];
  for (const s of list) while (!s.toLowerCase().startsWith(p.toLowerCase())) p = p.slice(0, -1);
  return p.trim().length >= 4 ? p : "";
}

/* ---------------------------------------------------------------- writing entries */

function entryFor(doc: Dictionary, fields: DictField[], match: DictionaryEntry["match"], term: string, classes?: string[]): DictionaryEntry {
  const base = "exact" in match ? (Array.isArray(match.exact) ? match.exact[0] : match.exact) : "startsWith" in match ? match.startsWith : "entry";
  const e: DictionaryEntry = {
    id: uniqueId(slug(`${fields[0] === "type_name" ? "type" : "mat"}-${base}`), doc.entries.map((x) => x.id)),
    field: fields.length === 1 ? fields[0] : fields,
    match,
    term,
    source: "user",
  };
  if (classes?.length) e.when = classes.map((c) => `ifc_class = "${c}"`).join(" OR ");
  return e;
}

/** Remove `raw` from this dictionary's exact entries for these fields (dropping entries left empty). */
function withoutExact(doc: Dictionary, raw: string, fields: DictField[]): DictionaryEntry[] {
  const hits = (e: DictionaryEntry) => {
    const ef = Array.isArray(e.field) ? e.field : [e.field];
    return "exact" in e.match && ef.some((f) => fields.includes(f));
  };
  return doc.entries.flatMap((e) => {
    if (!hits(e) || !("exact" in e.match)) return [e];
    const list = (Array.isArray(e.match.exact) ? e.match.exact : [e.match.exact]).filter((x) => x !== raw);
    if (list.length === 0) return [];
    return [{ ...e, match: { exact: list.length === 1 ? list[0] : list } }];
  });
}

/* ---------------------------------------------------------------- term picker */

function TermPicker({ value, terms, onPick, placeholder }: { value?: string | null; terms: KnownTerm[]; onPick: (id: string) => void; placeholder?: string }) {
  const id = useId();
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const byLabel = new Map(terms.map((t) => [`${t.label} (${t.id})`, t.id]));
  const commit = (s: string) => {
    const termId = terms.some((t) => t.id === s) ? s : byLabel.get(s);
    if (termId && termId !== value) onPick(termId);
    else if (!termId) setDraft(value ?? "");
  };
  return (
    <>
      <input
        type="text"
        className="mono term-pick"
        list={id}
        value={draft}
        placeholder={placeholder ?? "pick a term…"}
        onChange={(e) => {
          setDraft(e.target.value);
          if (terms.some((t) => t.id === e.target.value) || byLabel.has(e.target.value)) commit(e.target.value);
        }}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => e.key === "Enter" && commit(draft)}
      />
      <Options id={id} values={terms.map((t) => t.id)} labels={Object.fromEntries(terms.map((t) => [t.id, `${t.label} · ${t.category}`]))} />
    </>
  );
}

/* ---------------------------------------------------------------- the tab */

export function NamesTab({ doc, onChange, presets, model, known, loadDictionary, onOpenBoq }: {
  doc: Dictionary;
  onChange: (d: Dictionary) => void;
  presets: PresetsResponse | null;
  model: ModelSummary | null;
  known: KnownTerm[];
  loadDictionary: (id: string) => Promise<Dictionary>;
  onOpenBoq: () => void;
}) {
  const rank = LAYER_RANK[doc.layer];
  const others = (presets?.dictionaries ?? []).filter((d) => d.id !== doc.id);
  const [withIds, setWithIds] = useState<string[]>(() => others.filter((d) => LAYER_RANK[d.layer ?? "global"] < rank).map((d) => d.id));
  const [names, setNames] = useState<NameUse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [group, setGroup] = useState<Group>("materials");
  const [status, setStatus] = useState<Status>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkPrefix, setBulkPrefix] = useState(false);
  const [bulkOnly, setBulkOnly] = useState(false);

  const docJson = JSON.stringify(doc);
  useEffect(() => {
    if (!model) return;
    let live = true;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const dicts = [...(await Promise.all(withIds.map(loadDictionary))), JSON.parse(docJson) as Dictionary];
        const r = await api.names(model.modelId, { dictionaries: dicts });
        if (live) (setNames(r.names), setError(null));
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        if (live) setBusy(false);
      }
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [model, docJson, withIds, loadDictionary]);

  const label = (id: string | null) => (id ? known.find((t) => t.id === id)?.label ?? id : null);
  const dictName = (id?: string) => (id === doc.id ? "this dictionary" : others.find((d) => d.id === id)?.name ?? id ?? "");
  const rows = useMemo(() => (names ? rowsOf(names) : []), [names]);
  const inGroup = rows.filter((r) => r.group === group);
  const here = (r: Row) => r.uses.some((u) => u.dictionary === doc.id);
  const shown = inGroup
    .filter((r) => (status === "unresolved" ? !r.term : status === "here" ? here(r) : status === "elsewhere" ? r.term && !here(r) : true))
    .filter((r) => matches(q, r.raw, r.term ?? "", label(r.term) ?? ""))
    .sort((a, b) => Number(!!a.term) - Number(!!b.term) || Number(b.worthAsking) - Number(a.worthAsking) || a.raw.localeCompare(b.raw));
  const counts = (g: Group) => {
    const l = rows.filter((r) => r.group === g);
    return { all: l.length, open: l.filter((r) => !r.term).length };
  };

  /** Give these names a term in this dictionary. */
  const assign = (list: Row[], term: string, opts: { prefix?: string; classes?: string[] } = {}) => {
    let entries = doc.entries;
    const fieldsOf = (r: Row): DictField[] => (r.group === "materials" ? MATERIAL_FIELDS : r.fields);
    for (const r of list) entries = withoutExact({ ...doc, entries }, r.raw, fieldsOf(r));
    const byFields = new Map<string, Row[]>();
    for (const r of list) byFields.set(fieldsOf(r).join(","), [...(byFields.get(fieldsOf(r).join(",")) ?? []), r]);
    for (const [f, rs] of byFields) {
      const fields = f.split(",") as DictField[];
      const raws = [...new Set(rs.map((r) => r.raw))];
      const match = opts.prefix ? { startsWith: opts.prefix } : { exact: raws.length === 1 ? raws[0] : raws };
      entries = [...entries, entryFor({ ...doc, entries }, fields, match, term, opts.classes)];
    }
    onChange({ ...doc, entries });
    setSelected([]);
  };
  const forget = (r: Row) => onChange({ ...doc, entries: withoutExact(doc, r.raw, r.group === "materials" ? MATERIAL_FIELDS : r.fields) });

  if (!model)
    return (
      <div className="empty-panel">
        <p>
          Load a model to see the names it uses. Drop an IFC file in{" "}
          <button type="button" className="link" onClick={onOpenBoq}>
            Bill of quantities
          </button>
          , then come back: the model stays loaded.
        </p>
        <p className="muted small">Try fixtures/ifc/Ifc2x3_Duplex_Architecture.ifc from this repository.</p>
      </div>
    );

  const sel = shown.filter((r) => selected.includes(r.key));
  const prefix = commonPrefix(sel.map((r) => r.raw));
  const selClasses = [...new Set(sel.flatMap((r) => r.classes))].sort();

  return (
    <div className="names-tab">
      <p className="hint">
        Every material and type name in <b>{model.fileName}</b>, and what it means. Give a name a term and it is saved in this dictionary ({doc.layer} layer); every
        model with the same name is then understood.
      </p>
      <div className="nt-with">
        <span className="f-label">Resolved with</span>
        <span className="chip on-static">{doc.name} (this, {doc.layer})</span>
        {others.map((d) => {
          const on = withIds.includes(d.id);
          return (
            <button key={d.id} type="button" className={`chip toggle ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setWithIds(on ? withIds.filter((x) => x !== d.id) : [...withIds, d.id])}>
              {d.name} ({d.layer})
            </button>
          );
        })}
      </div>
      <div className="nt-tools">
        <div className="seg" role="tablist">
          {(["materials", "types"] as const).map((g) => (
            <button key={g} role="tab" aria-selected={group === g} className={group === g ? "on" : ""} onClick={() => (setGroup(g), setSelected([]))}>
              {g === "materials" ? "Materials" : "Type names"} <span className="muted">{counts(g).all}</span>
              {counts(g).open > 0 && <span className="q-count">{counts(g).open} open</span>}
            </button>
          ))}
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          <option value="all">all names</option>
          <option value="unresolved">not understood yet</option>
          <option value="here">answered by this dictionary</option>
          <option value="elsewhere">answered by another dictionary</option>
        </select>
        <input type="search" placeholder="Filter names" value={q} onChange={(e) => setQ(e.target.value)} />
        {busy && <span className="muted small">resolving…</span>}
      </div>
      {error && <p className="error">{error}</p>}
      {names && inGroup.some((r) => !r.term) && (
        <p className="hint">
          {inGroup.some((r) => !r.term && r.worthAsking)
            ? "Names marked “worth answering” affect how elements are measured or coded; a BoQ run asks about them. The others can stay as they are."
            : "None of the names not understood yet affects measuring (door, window and furniture sizes rarely need a meaning); a BoQ run will not ask about them. Give them a term only if your rules or codes should use it."}
        </p>
      )}

      {sel.length > 0 && (
        <div className="nt-bulk">
          <b>{sel.length} selected</b>
          <span>mean</span>
          <TermPicker terms={known} onPick={(t) => assign(sel, t, { prefix: bulkPrefix ? prefix : undefined, classes: bulkOnly ? selClasses : undefined })} />
          {prefix && (
            <label className="option inline">
              <input type="checkbox" checked={bulkPrefix} onChange={(e) => setBulkPrefix(e.target.checked)} />
              <span>
                as every name starting with “<b>{prefix}</b>”
              </span>
            </label>
          )}
          <label className="option inline">
            <input type="checkbox" checked={bulkOnly} onChange={(e) => setBulkOnly(e.target.checked)} />
            <span>only on {selClasses.map((c) => c.replace(/^Ifc/, "")).join(", ")}</span>
          </label>
          <button type="button" className="link small" onClick={() => setSelected([])}>
            clear
          </button>
        </div>
      )}

      {names && (
        <div className="nt-table">
          <div className="nt-row nt-head">
            <span />
            <span>Name in the model</span>
            <span>Used on</span>
            <span>Means</span>
            <span>Answered by</span>
          </div>
          {shown.length === 0 && <p className="muted small nt-empty">No names match.</p>}
          {shown.map((r) => {
            const use = r.uses.find((u) => u.term) ?? r.uses[0];
            const mine = here(r);
            const higher = r.term && !mine && use.layer && LAYER_RANK[use.layer] > rank;
            const suggestion = !r.term ? suggestTerm(r.raw, known) : null;
            const extracted = Object.entries(use.extracted ?? {});
            return (
              <div key={r.key} className={`nt-row ${r.term ? "" : "open"} ${r.worthAsking ? "ask" : ""}`}>
                <span>
                  <input type="checkbox" aria-label={`Select ${r.raw}`} checked={selected.includes(r.key)} onChange={(e) => setSelected(e.target.checked ? [...selected, r.key] : selected.filter((k) => k !== r.key))} />
                </span>
                <span className="nt-raw">
                  <b>{r.raw}</b>
                  {r.worthAsking && <span className="badge badge-changed">worth answering</span>}
                  {extracted.length > 0 && (
                    <span className="muted small block">
                      read from the name: {extracted.map(([k, v]) => `${k} ${v}`).join(", ")}
                    </span>
                  )}
                </span>
                <span className="small">
                  {r.count} element{r.count === 1 ? "" : "s"}
                  <span className="muted block">{r.classes.map((c) => c.replace(/^Ifc/, "")).join(", ")}</span>
                </span>
                <span className="nt-term">
                  <TermPicker value={r.term} terms={known} onPick={(t) => assign([r], t)} placeholder={r.term ? undefined : "not understood: pick a term"} />
                  {r.term && <span className="small">{label(r.term)}</span>}
                  {suggestion && (
                    <span className="ct-suggest small">
                      Suggestion: <b>{suggestion.label}</b>{" "}
                      <button type="button" className="link small" onClick={() => assign([r], suggestion.id)}>
                        use
                      </button>
                    </span>
                  )}
                </span>
                <span className="small">
                  {r.term ? (
                    <>
                      {dictName(use.dictionary)}
                      <span className="muted block">
                        {use.layer} layer, {use.method === "startsWith" ? "starts with" : use.method}
                        {use.entryId ? ` (${use.entryId})` : ""}
                      </span>
                      {mine && use.method === "exact" && (
                        <button type="button" className="link small" onClick={() => forget(r)} title="Remove this name from this dictionary">
                          remove here
                        </button>
                      )}
                      {higher && <span className="note small block">A {use.layer} dictionary answers this first; an answer here would not be used.</span>}
                    </>
                  ) : (
                    <span className="muted">nobody yet</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
