/**
 * The preset library: browse, create, import and edit rule sets, classifications and
 * dictionaries. Drafts live in browser memory (see store.ts); the engine is asked only
 * to check a draft and to flatten a patch's parent, never to save anything.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Dictionary, ModelSummary, OurRuleType, PresetsResponse, RuleSet } from "@ifc-boq/types";
import { api } from "../api";
import {
  KIND_LABEL,
  blankClassification,
  blankDictionary,
  blankPatch,
  blankRuleSet,
  detectKind,
  docId,
  docName,
  downloadJson,
  isEdited,
  isPatch,
  presetKey,
  slug,
  uniqueId,
  type AnyDoc,
  type ClassificationDoc,
  type LibDoc,
  type LibKind,
  type LibState,
} from "./store";
import { RuleSetEditor } from "./RuleSetEditor";
import { DictionaryEditor } from "./DictionaryEditor";
import { ClassificationEditor } from "./ClassificationEditor";
import { Field, Select, Text } from "./fields";

interface Props {
  head: ReactNode;
  /** The model loaded in the BoQ view, if any (the dictionary editor lists its names). */
  model: ModelSummary | null;
  onOpenBoq: () => void;
  presets: PresetsResponse | null;
  presetsError: string | null;
  onRetryPresets: () => void;
  lib: LibState;
  setLib: (f: (s: LibState) => LibState) => void;
  sel: string | null;
  setSel: (k: string | null) => void;
}

const KINDS: LibKind[] = ["rules", "classifications", "dictionaries"];
const SECTION: Record<LibKind, { title: string; hint: string }> = {
  rules: { title: "Rule sets", hint: "How quantities are measured. Changes the numbers." },
  classifications: { title: "Classifications", hint: "Codes and grouping. Never changes numbers." },
  dictionaries: { title: "Dictionaries", hint: "What names in the model mean." },
};

let counter = 0;

export function Library({ head, model, onOpenBoq, presets, presetsError, onRetryPresets, lib, setLib, sel, setSel }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const drafts = Object.values(lib);
  const idsOf = (kind: LibKind) => new Set([...(presetList(kind).map((p) => p.id)), ...drafts.filter((d) => d.kind === kind).map((d) => docId(kind, d.doc))]);
  function presetList(kind: LibKind) {
    if (!presets) return [];
    return kind === "rules" ? presets.ruleSets : kind === "dictionaries" ? presets.dictionaries : presets.classifications;
  }

  /** The current draft of a preset or new document, by id; loads a shipped preset if needed. */
  async function getDoc(kind: LibKind, id: string): Promise<AnyDoc> {
    const d = drafts.find((x) => x.kind === kind && docId(kind, x.doc) === id);
    if (d) return d.doc;
    return (await api.preset(kind, id)) as AnyDoc;
  }

  async function open(kind: LibKind, id: string) {
    const key = presetKey(kind, id);
    setSel(key);
    setError(null);
    if (lib[key]) return;
    setLoading(key);
    try {
      const doc = (await api.preset(kind, id)) as AnyDoc;
      setLib((s) => ({ ...s, [key]: { key, kind, origin: "preset", presetId: id, doc, original: JSON.stringify(doc) } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  function addDraft(kind: LibKind, doc: AnyDoc) {
    const key = `${kind}:new:${++counter}`;
    setLib((s) => ({ ...s, [key]: { key, kind, origin: "new", doc, original: "" } }));
    setSel(key);
  }

  async function importFile(f?: File) {
    if (!f) return;
    setError(null);
    try {
      const found = detectKind(JSON.parse(await f.text()));
      if (!found) throw new Error(`${f.name} does not look like a rule set, dictionary, code list or classification.`);
      const { kind, doc } = found;
      const id = uniqueId(docId(kind, doc), idsOf(kind));
      addDraft(kind, withId(kind, doc, id, docName(kind, doc)));
    } catch (e) {
      setError(`Import failed: ${(e as Error).message}`);
    }
  }

  const dictDraftsJson = JSON.stringify(drafts.filter((d) => d.kind === "dictionaries").map((d) => d.doc));
  /** A dictionary as currently drafted, or the shipped preset. */
  const loadDictionary = useCallback(
    async (id: string): Promise<Dictionary> =>
      (JSON.parse(dictDraftsJson) as Dictionary[]).find((d) => d.id === id) ?? ((await api.preset("dictionaries", id)) as Dictionary),
    [dictDraftsJson],
  );

  const current = sel ? lib[sel] : undefined;
  const creating = sel?.startsWith("create:") ? (sel.slice(7) as LibKind) : null;

  return (
    <>
      <aside className="side">
        {head}
        {presetsError && (
          <div className="error">
            {presetsError}{" "}
            <button className="link" onClick={onRetryPresets}>
              Retry
            </button>
          </div>
        )}
        {KINDS.map((kind) => {
          const newOnes = drafts.filter((d) => d.kind === kind && d.origin === "new");
          return (
            <fieldset key={kind}>
              <legend>{SECTION[kind].title}</legend>
              <p className="hint">{SECTION[kind].hint}</p>
              <ul className="lib-list">
                {presetList(kind).map((p) => {
                  const key = presetKey(kind, p.id);
                  const d = lib[key];
                  const unavailable = "available" in p && !p.available;
                  return (
                    <li key={key}>
                      <button className={`lib-item ${sel === key ? "on" : ""}`} disabled={unavailable} title={unavailable ? (p as { reason?: string }).reason : undefined} onClick={() => void open(kind, p.id)}>
                        <span>{d ? docName(kind, d.doc) : p.name}</span>
                        {d && isEdited(d) && <span className="dot" aria-label="edited" title="Edited in this tab" />}
                        {"extends" in p && p.extends && <span className="muted small block">extends {p.extends}</span>}
                        {"layer" in p && p.layer && <span className="muted small block">{p.layer} layer</span>}
                        {unavailable && <span className="muted small block">not installed</span>}
                      </button>
                    </li>
                  );
                })}
                {newOnes.map((d) => (
                  <li key={d.key}>
                    <button className={`lib-item ${sel === d.key ? "on" : ""}`} onClick={() => setSel(d.key)}>
                      <span>{docName(kind, d.doc)}</span>
                      <span className="badge badge-new">new</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button className="link small" onClick={() => setSel(`create:${kind}`)}>
                + New {KIND_LABEL[kind].toLowerCase()}
              </button>
            </fieldset>
          );
        })}
        <fieldset>
          <legend>Import</legend>
          <p className="hint">A rule set, dictionary, code list or classification as JSON. It opens as a new draft.</p>
          <button className="ghost" onClick={() => file.current?.click()}>
            Import JSON file
          </button>
          <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => (void importFile(e.target.files?.[0]), (e.target.value = ""))} />
        </fieldset>
        <p className="small muted lib-note">Drafts stay in this browser tab and are lost on reload. BoQ runs still use the files in <code>presets/</code>; download a draft to keep it.</p>
      </aside>

      <main className="main">
        {error && <p className="error">{error}</p>}
        {!current && !creating && (
          <div className="empty">
            <h1>Rules, codes and names</h1>
            <p>
              The three inputs you choose for a BoQ: <b>rule sets</b> decide how elements are measured, <b>classifications</b> give lines their codes and grouping, <b>dictionaries</b> turn messy names
              in the model into terms the rules can match.
            </p>
            <p className="muted">Open one on the left to see how it is built, change it, or start a new one. Nothing is saved yet.</p>
            {loading && <p className="muted">Loading…</p>}
          </div>
        )}
        {creating && (
          <CreatePanel
            key={creating}
            kind={creating}
            presets={presets}
            draftsOf={drafts.filter((d) => d.kind === creating)}
            taken={idsOf(creating)}
            getDoc={getDoc}
            onCreate={(doc) => addDraft(creating, doc)}
            onCancel={() => setSel(null)}
          />
        )}
        {current && (
          <Editor
            key={current.key}
            entry={current}
            drafts={drafts}
            presets={presets}
            model={model}
            loadDictionary={loadDictionary}
            onOpenBoq={onOpenBoq}
            ruleSetIds={[...idsOf("rules")]}
            onChange={(doc) => setLib((s) => ({ ...s, [current.key]: { ...s[current.key], doc } }))}
            onReset={() => setLib((s) => ({ ...s, [current.key]: { ...s[current.key], doc: JSON.parse(current.original) as AnyDoc } }))}
            onDelete={() => {
              setLib((s) => {
                const { [current.key]: _gone, ...rest } = s;
                void _gone;
                return rest;
              });
              setSel(null);
            }}
            onDuplicate={() => {
              const id = uniqueId(`${docId(current.kind, current.doc)}-copy`, idsOf(current.kind));
              addDraft(current.kind, withId(current.kind, structuredClone(current.doc), id, `${docName(current.kind, current.doc)} (copy)`));
            }}
          />
        )}
      </main>
    </>
  );
}

function withId(kind: LibKind, doc: AnyDoc, id: string, name: string): AnyDoc {
  if (kind !== "classifications") return { ...(doc as OurRuleType | Dictionary), id, name } as AnyDoc;
  const c = doc as ClassificationDoc;
  return { codeList: { ...c.codeList, id, name }, map: { ...c.map, id: `${id}-map`, codeList: id } };
}

/* ================================================================ create */

function CreatePanel({ kind, presets, draftsOf, taken, getDoc, onCreate, onCancel }: {
  kind: LibKind;
  presets: PresetsResponse | null;
  draftsOf: LibDoc[];
  taken: Set<string>;
  getDoc: (kind: LibKind, id: string) => Promise<AnyDoc>;
  onCreate: (doc: AnyDoc) => void;
  onCancel: () => void;
}) {
  const sources = [
    ...(kind === "rules" ? presets?.ruleSets ?? [] : kind === "dictionaries" ? presets?.dictionaries ?? [] : (presets?.classifications ?? []).filter((c) => c.available)).map((p) => p.id),
    ...draftsOf.filter((d) => d.origin === "new").map((d) => docId(kind, d.doc)),
  ];
  const [name, setName] = useState("");
  const [start, setStart] = useState<"empty" | "extend" | "copy">(kind === "rules" ? "extend" : "empty");
  const [from, setFrom] = useState<string | undefined>(sources.includes("as-modelled") ? "as-modelled" : sources[0]);
  const [layer, setLayer] = useState<Dictionary["layer"]>("company");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = uniqueId(slug(name || `new-${kind === "rules" ? "rule-set" : kind === "dictionaries" ? "dictionary" : "classification"}`), taken);
  const label = name || "Untitled";

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      if (start === "extend" && from) onCreate(blankPatch(id, label, from));
      else if (start === "copy" && from) onCreate(withId(kind, structuredClone(await getDoc(kind, from)), id, label));
      else onCreate(kind === "rules" ? blankRuleSet(id, label) : kind === "dictionaries" ? blankDictionary(id, label, layer) : blankClassification(id, label));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const starts = (kind === "rules" ? ["extend", "copy", "empty"] : ["empty", "copy"]) as ("empty" | "extend" | "copy")[];
  const startLabel = {
    extend: "Extend an existing rule set (store only the differences)",
    copy: "Copy an existing one",
    empty: "Start empty",
  };
  return (
    <div className="create">
      <h1>New {KIND_LABEL[kind].toLowerCase()}</h1>
      <div className="form">
        <div className="f-grid">
          <Field label="Name">
            <Text value={name} onChange={(v) => setName(v ?? "")} placeholder={kind === "rules" ? "e.g. Our house rules" : "Name"} optional={false} />
          </Field>
          <Field label="Id" hint="Generated from the name; editable later.">
            <input type="text" className="mono" value={id} readOnly />
          </Field>
          {kind === "dictionaries" && start === "empty" && (
            <Field label="Layer">
              <Select value={layer} options={["company", "project", "global"] as const} onChange={(v) => setLayer(v ?? "company")} />
            </Field>
          )}
        </div>
        <fieldset className="starts">
          <legend>Start from</legend>
          {starts.map((s) => (
            <label key={s} className="option">
              <input type="radio" name="start" checked={start === s} onChange={() => setStart(s)} />
              <span>
                {startLabel[s]}
                {s === "extend" && <span className="muted block">Recommended for a firm's or project's variant of a standard: changes to the parent flow through.</span>}
              </span>
            </label>
          ))}
          {start !== "empty" && (
            <Field label={start === "extend" ? "Parent rule set" : "Copy of"}>
              <Select value={from} options={sources} onChange={setFrom} />
            </Field>
          )}
        </fieldset>
        {error && <p className="error">{error}</p>}
        <div className="json-actions">
          <button className="primary" disabled={busy || (start !== "empty" && !from)} onClick={() => void create()}>
            Create draft
          </button>
          <button className="ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================ editor host */

function Editor({ entry, drafts, presets, model, loadDictionary, onOpenBoq, ruleSetIds, onChange, onReset, onDelete, onDuplicate }: {
  entry: LibDoc;
  drafts: LibDoc[];
  presets: PresetsResponse | null;
  model: ModelSummary | null;
  loadDictionary: (id: string) => Promise<Dictionary>;
  onOpenBoq: () => void;
  ruleSetIds: string[];
  onChange: (d: AnyDoc) => void;
  onReset: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const { kind, doc } = entry;
  const [check, setCheck] = useState<{ json: string; problems: string[] } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const json = JSON.stringify(doc);
  const othersOfKind = drafts.filter((d) => d.kind === kind && d.key !== entry.key).map((d) => d.doc);

  const runCheck = async () => {
    setChecking(true);
    setCheckError(null);
    try {
      const r = await api.checkPreset(kind, { doc, library: othersOfKind });
      setCheck({ json, problems: r.problems });
    } catch (e) {
      setCheckError((e as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const parent = useParent(kind === "rules" ? (doc as OurRuleType) : null, drafts);
  const ruleDraftsJson = JSON.stringify(drafts.filter((d) => d.kind === "rules").map((d) => d.doc));
  /** A rule set as the engine flattens it (drafts included), for the classification table's rows. */
  const loadRuleSet = useCallback(
    async (id: string): Promise<RuleSet | null> => {
      const ruleDrafts = JSON.parse(ruleDraftsJson) as OurRuleType[];
      const raw = ruleDrafts.find((d) => d.id === id) ?? (await api.preset("rules", id));
      return (await api.checkPreset("rules", { doc: raw, library: ruleDrafts })).flattened ?? null;
    },
    [ruleDraftsJson],
  );
  const ruleSetOptions = [
    ...(presets?.ruleSets ?? []).map((r) => ({ id: r.id, name: r.name })),
    ...drafts.filter((d) => d.kind === "rules" && d.origin === "new").map((d) => ({ id: docId("rules", d.doc), name: `${docName("rules", d.doc)} (draft)` })),
  ];
  const download = () => {
    const id = docId(kind, doc);
    if (kind === "classifications") {
      const c = doc as ClassificationDoc;
      downloadJson(`${id}.codelist.json`, c.codeList);
      downloadJson(`${id}.map.json`, c.map);
    } else downloadJson(`${id}.json`, doc);
  };
  const edited = isEdited(entry);
  const where =
    kind === "rules" ? `presets/rules/${docId(kind, doc)}.json` : kind === "dictionaries" ? `presets/dictionaries/${docId(kind, doc)}.json` : `presets/classifications/${docId(kind, doc)}/codelist.json + map.json`;

  return (
    <>
      <header className="result-head">
        <div>
          <h1>
            {docName(kind, doc) || "Untitled"}
            <span className="kind">{KIND_LABEL[kind]}</span>
            {entry.origin === "new" ? <span className="badge badge-new">new draft</span> : edited ? <span className="badge badge-changed">edited</span> : null}
          </h1>
          <p className="muted small">
            <code>{docId(kind, doc)}</code> · {entry.origin === "preset" ? `shipped preset (${where})` : `not saved; download and place at ${where}`}
          </p>
        </div>
        <div className="head-actions">
          <button className="ghost" onClick={() => void runCheck()} disabled={checking} title="Ask the engine whether it would accept this draft">
            {checking ? "Checking" : "Check"}
          </button>
          <button className="ghost" onClick={download}>
            Download JSON
          </button>
          <button className="ghost" onClick={onDuplicate}>
            Duplicate
          </button>
          {entry.origin === "preset" ? (
            <button className="ghost" onClick={onReset} disabled={!edited}>
              Reset changes
            </button>
          ) : (
            <button className="ghost danger" onClick={onDelete}>
              Delete draft
            </button>
          )}
        </div>
      </header>
      {checkError && <p className="error">{checkError}</p>}
      {check && (
        <div className={`check ${check.problems.length ? "bad" : "good"}`}>
          {check.problems.length === 0 ? (
            <span>The engine accepts this draft.</span>
          ) : (
            <>
              <span>
                The engine found {check.problems.length} problem{check.problems.length === 1 ? "" : "s"}:
              </span>
              <ul>
                {check.problems.map((p, i) => (
                  <li key={i}>
                    <code>{p}</code>
                  </li>
                ))}
              </ul>
            </>
          )}
          {check.json !== json && <span className="muted small"> Edited since this check.</span>}
          <button className="link small" onClick={() => setCheck(null)}>
            hide
          </button>
        </div>
      )}
      {kind === "rules" && (
        <RuleSetEditor doc={doc as OurRuleType} onChange={onChange} parent={parent.flat} parentNote={parent.note} ruleSetIds={ruleSetIds} />
      )}
      {kind === "dictionaries" && (
        <DictionaryEditor doc={doc as Dictionary} onChange={onChange} presets={presets} model={model} loadDictionary={loadDictionary} onOpenBoq={onOpenBoq} />
      )}
      {kind === "classifications" && (
        <ClassificationEditor doc={doc as ClassificationDoc} onChange={onChange} presets={presets} ruleSets={ruleSetOptions} loadRuleSet={loadRuleSet} />
      )}
    </>
  );
}

/** For a patch: its parent flattened by the engine (parent may itself be a draft or a patch). */
function useParent(doc: OurRuleType | null, drafts: LibDoc[]): { flat: RuleSet | null; note?: string } {
  const parentId = doc && isPatch(doc) ? doc.extends : null;
  const ruleDrafts = drafts.filter((d) => d.kind === "rules");
  const parentDraft = ruleDrafts.find((d) => docId("rules", d.doc) === parentId);
  const draftsJson = JSON.stringify(ruleDrafts.filter((d) => d.doc !== doc).map((d) => d.doc));
  const [state, setState] = useState<{ flat: RuleSet | null; note?: string }>({ flat: null });

  useEffect(() => {
    if (!parentId) return setState({ flat: null });
    let live = true;
    setState({ flat: null });
    (async () => {
      const raw = parentDraft ? parentDraft.doc : await api.preset("rules", parentId);
      const r = await api.checkPreset("rules", { doc: raw, library: JSON.parse(draftsJson) as unknown[] });
      if (!live) return;
      setState(r.flattened ? { flat: r.flattened } : { flat: null, note: `The parent cannot be resolved: ${r.problems[0] ?? "unknown error"}` });
    })().catch((e: Error) => live && setState({ flat: null, note: `The parent “${parentId}” could not be loaded: ${e.message}` }));
    return () => {
      live = false;
    };
    // Re-resolve when the parent id or any rule-set draft changes (the parent may be one).
  }, [parentId, draftsJson]);

  return state;
}
