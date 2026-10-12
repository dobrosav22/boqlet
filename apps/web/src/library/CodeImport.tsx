/**
 * Import a code list from a spreadsheet: choose the file, see it, say which column is the code,
 * the title, and where the hierarchy comes from; the engine reads the file and builds the codes
 * (POST /api/codelists/read and /build), so the app and the command-line importer agree.
 */
import { useEffect, useRef, useState } from "react";
import type { CodeHierarchy, CodeList, CodeListBuildRequest, CodeListBuildResponse, TableReadResponse } from "@ifc-boq/types";
import { api } from "../api";
import { Field, Select, ToggleChips } from "./fields";

type Sheet = TableReadResponse["sheets"][number];
type Mapping = CodeListBuildRequest["mapping"];
type Role = "code" | "title" | "parent" | "description" | "level";

const letter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
const HIERARCHY_LABEL: Record<CodeHierarchy, string> = {
  separator: "from the codes (B.01 is under B)",
  parent: "from a parent-code column",
  level: "from a level column (1, 2, 3…)",
  flat: "none: a flat list",
};
const ROLE_LABEL: Record<Role, string> = { code: "code", title: "title", parent: "parent", description: "description", level: "level" };

export function CodeImport({ list, onImport, onCancel }: { list: CodeList; onImport: (cl: CodeList) => void; onCancel: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Partial<Mapping>>({});
  const [hierarchy, setHierarchy] = useState<CodeHierarchy>("separator");
  const [separator, setSeparator] = useState<string>("");
  const [mode, setMode] = useState<"replace" | "merge">(list.codes.length ? "merge" : "replace");
  const [result, setResult] = useState<CodeListBuildResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sheet = sheets[sheetIdx];
  const width = sheet ? Math.max(...sheet.rows.slice(0, 50).map((r) => r.length), 0) : 0;
  const head = sheet?.rows[headerRow] ?? [];
  const colLabel = (i: number) => `${letter(i)} · ${head[i] || "(no header)"}`;
  const cols = Array.from({ length: width }, (_, i) => i);

  const applyGuess = (s: Sheet) => {
    const g = s.guess;
    setHeaderRow(g.headerRow);
    setMapping({ code: g.code, title: g.title, parent: g.parent, description: g.description, level: g.level, extra: [] });
    setHierarchy(g.parent !== undefined ? "parent" : g.level !== undefined ? "level" : g.separator ? "separator" : "flat");
    setSeparator(g.separator ?? "");
  };

  const read = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.readCodeTable(f);
      setFileName(f.name);
      setSheets(r.sheets);
      setSheetIdx(0);
      applyGuess(r.sheets[0]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Rebuild the preview whenever the mapping changes (the engine builds; this only shows it).
  useEffect(() => {
    if (!sheet || mapping.code === undefined || mapping.title === undefined) return setResult(null);
    let live = true;
    const t = setTimeout(() => {
      api
        .buildCodes({ rows: sheet.rows, headerRow, mapping: mapping as Mapping, hierarchy, separator: hierarchy === "separator" ? separator || null : null })
        .then((r) => live && (setResult(r), setError(null)))
        .catch((e: Error) => live && setError(e.message));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [sheet, headerRow, mapping, hierarchy, separator]);

  const setCol = (role: Role, v: string) => setMapping((m) => ({ ...m, [role]: v === "" ? undefined : Number(v), extra: (m.extra ?? []).filter((x) => x !== Number(v)) }));
  const roleOf = (i: number) => (Object.keys(ROLE_LABEL) as Role[]).find((r) => mapping[r] === i);
  const colSelect = (role: Role, optional: boolean) => (
    <select value={mapping[role] ?? ""} onChange={(e) => setCol(role, e.target.value)}>
      {optional && <option value="">(none)</option>}
      {!optional && mapping[role] === undefined && <option value="">choose…</option>}
      {cols.map((i) => (
        <option key={i} value={i}>
          {colLabel(i)}
        </option>
      ))}
    </select>
  );

  const apply = () => {
    if (!result) return;
    const byCode = new Map((mode === "merge" ? list.codes : []).map((c) => [c.code, c]));
    for (const c of result.codes) byCode.set(c.code, { ...byCode.get(c.code), ...c });
    const next: CodeList = { ...list, codes: [...byCode.values()] };
    if (hierarchy === "separator" && separator) next.separator = separator;
    else delete next.separator;
    onImport(next);
  };

  if (!sheet)
    return (
      <div className="cimport">
        <h3>Import codes from a spreadsheet</h3>
        <p className="hint">Excel (.xlsx) or CSV / TSV. Any layout: you will choose which column is the code, the title and the parent on the next step.</p>
        <div className="drop" role="button" tabIndex={0} onClick={() => file.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && file.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => (e.preventDefault(), void read(e.dataTransfer.files[0]))}>
          <strong>{busy ? "Reading…" : "Drop a file here"}</strong>
          <span>or click to choose one</span>
        </div>
        <input ref={file} type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt" hidden onChange={(e) => (void read(e.target.files?.[0]), (e.target.value = ""))} />
        {error && <p className="error">{error}</p>}
        <button type="button" className="link small" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );

  const preview = sheet.rows.slice(headerRow, headerRow + 9);
  return (
    <div className="cimport">
      <h3>
        Import codes from <span className="mono">{fileName}</span>
      </h3>
      <div className="f-grid">
        {sheets.length > 1 && (
          <Field label="Sheet">
            <select value={sheetIdx} onChange={(e) => (setSheetIdx(Number(e.target.value)), applyGuess(sheets[Number(e.target.value)]))}>
              {sheets.map((s, i) => (
                <option key={i} value={i}>
                  {s.name} ({s.rows.length} rows)
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Header row" hint="The row with the column names; rows above it are skipped.">
          <input type="number" min={1} max={sheet.rows.length} value={headerRow + 1} onChange={(e) => setHeaderRow(Math.max(0, Math.min(sheet.rows.length - 1, Number(e.target.value) - 1)))} />
        </Field>
        <Field label="Code column">{colSelect("code", false)}</Field>
        <Field label="Title column">{colSelect("title", false)}</Field>
        <Field label="Description column">{colSelect("description", true)}</Field>
        <Field label="Hierarchy">
          <Select value={hierarchy} options={["separator", "parent", "level", "flat"] as const} labels={HIERARCHY_LABEL} onChange={(h) => setHierarchy(h ?? "flat")} />
        </Field>
        {hierarchy === "separator" && (
          <Field label="Separator in codes" hint="The character between code parts.">
            <input type="text" className="mono" value={separator} maxLength={3} onChange={(e) => setSeparator(e.target.value)} placeholder="." />
          </Field>
        )}
        {hierarchy === "parent" && <Field label="Parent column">{colSelect("parent", false)}</Field>}
        {hierarchy === "level" && <Field label="Level column">{colSelect("level", false)}</Field>}
        <Field label="Keep other columns" group wide hint="Kept with each code as extra information (e.g. a reference to another system).">
          <ToggleChips
            options={cols.filter((i) => roleOf(i) === undefined).map(String)}
            selected={(mapping.extra ?? []).map(String)}
            labels={Object.fromEntries(cols.map((i) => [String(i), colLabel(i)]))}
            onChange={(l) => setMapping((m) => ({ ...m, extra: l.map(Number) }))}
          />
        </Field>
      </div>

      <div className="ci-preview">
        <table className="contrib">
          <thead>
            <tr>
              {cols.map((i) => (
                <th key={i} className={roleOf(i) ? "mapped" : ""}>
                  {letter(i)} {roleOf(i) && <span className="badge badge-new">{ROLE_LABEL[roleOf(i)!]}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((r, n) => (
              <tr key={n} className={n === 0 ? "ci-head" : ""}>
                {cols.map((i) => (
                  <td key={i} className={roleOf(i) ? "mapped" : ""}>
                    {r[i]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          Rows {headerRow + 1}–{headerRow + preview.length} of {sheet.rows.length}; the first one is the header.
        </p>
      </div>

      {error && <p className="error">{error}</p>}
      {result && (
        <div className="ci-result">
          <p>
            <b>{result.stats.codes} codes</b>, {result.stats.top} at the top level, {result.stats.levels} level{result.stats.levels === 1 ? "" : "s"}.
          </p>
          {result.problems.length > 0 && (
            <ul className="note small">
              {result.problems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}
          <div className="ci-tree">
            {result.codes.slice(0, 40).map((c) => (
              <div key={c.code} style={{ paddingLeft: (c.level ?? 0) * 18 }} className={c.level ? "" : "top"}>
                <span className="mono">{c.code}</span> {c.title || <span className="muted">(no title)</span>}
              </div>
            ))}
            {result.codes.length > 40 && <div className="muted small">… and {result.codes.length - 40} more</div>}
          </div>
        </div>
      )}

      <div className="json-actions">
        {list.codes.length > 0 && (
          <Select value={mode} options={["merge", "replace"] as const} labels={{ merge: "add to the existing codes (same code = update)", replace: "replace all existing codes" }} onChange={(m) => setMode(m ?? "merge")} />
        )}
        <button type="button" className="primary" disabled={!result || result.stats.codes === 0} onClick={apply}>
          Import {result ? result.stats.codes : ""} codes
        </button>
        <button type="button" className="ghost" onClick={() => (setSheets([]), setResult(null))}>
          Choose another file
        </button>
        <button type="button" className="link small" onClick={onCancel}>
          Cancel
        </button>
        {busy && <span className="muted small">working…</span>}
      </div>
    </div>
  );
}
