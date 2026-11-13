"use client";

/**
 * Import a code list from a spreadsheet (the PoC's `CodeImport.tsx`, F10 §8): choose the file, see
 * it, say which column is the code, the title, the item text and where the hierarchy comes from;
 * the engine reads the file and builds the codes (`POST /codelists/read` and `/codelists/build`), so
 * the app and the command-line importer agree. Nothing is stored until the codes go into the draft.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Schemas } from "@ifc-boq/api";
import type { CodeHierarchy, CodeList, CodeListBuildResponse, TableColumnGuess } from "@ifc-boq/types";
import { api } from "@/api/client";
import { isApiError } from "@/api/errors";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Field, Select, inputClass, linkButton } from "../shared/fields";
import { mergeCodes } from "./model";

type Sheet = Schemas["TableReadResponse"]["sheets"][number];
type Role = "code" | "title" | "parent" | "description" | "level";
const ROLES = ["code", "title", "parent", "description", "level"] as const satisfies readonly Role[];
const HIERARCHIES = ["separator", "parent", "level", "flat"] as const satisfies readonly CodeHierarchy[];

interface Params {
  sheetIdx: number;
  headerRow: number;
  mapping: Partial<Record<Role, number>>;
  hierarchy: CodeHierarchy;
  separator: string;
}

/** Spreadsheet column letters: A … Z, AA … */
export const letter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));

/** The column choices and hierarchy the engine guessed for a sheet. */
export function paramsFromGuess(sheetIdx: number, g: TableColumnGuess): Params {
  return {
    sheetIdx,
    headerRow: g.headerRow ?? 0,
    mapping: { code: g.code, title: g.title, parent: g.parent, description: g.description, level: g.level },
    hierarchy: g.parent !== undefined ? "parent" : g.level !== undefined ? "level" : g.separator ? "separator" : "flat",
    separator: g.separator ?? "",
  };
}

const PREVIEW_ROWS = 9;
const PREVIEW_CODES = 40;

export function CodeImport({ list, onImport, onCancel }: { list: CodeList; onImport: (cl: CodeList) => void; onCancel: () => void }) {
  const t = useTranslations("classificationEditor.import");
  const errorMessage = useErrorMessage();
  const file = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [params, setParams] = useState<Params>({ sheetIdx: 0, headerRow: 0, mapping: {}, hierarchy: "separator", separator: "" });
  const [mode, setMode] = useState<"replace" | "merge">(list.codes.length ? "merge" : "replace");
  const [result, setResult] = useState<CodeListBuildResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The preview is rebuilt by the engine a moment after each change (the engine builds; this only shows it).
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const describe = (e: unknown) =>
    isApiError(e) && e.code === "invalid_file" ? t("invalidFile", { reason: e.message }) : isApiError(e) && e.code === "invalid_body" && e.message ? e.message : errorMessage(e);

  const rebuild = (p: Params, all: Sheet[]) => {
    clearTimeout(timer.current);
    const sheet = all[p.sheetIdx];
    const n = ++seq.current;
    const { code, title, parent, description, level } = p.mapping;
    if (!sheet || code === undefined || title === undefined) {
      setResult(null);
      return;
    }
    timer.current = setTimeout(() => {
      setBusy(true);
      api
        .POST("/codelists/build", {
          body: { rows: sheet.rows, headerRow: p.headerRow, code, title, parent, description, level, hierarchy: p.hierarchy, separator: p.hierarchy === "separator" ? p.separator || null : null },
        })
        .then(({ data }) => {
          if (n !== seq.current) return;
          setResult((data as CodeListBuildResponse | undefined) ?? null);
          setError(null);
        })
        .catch((e: unknown) => n === seq.current && setError(describe(e)))
        .finally(() => n === seq.current && setBusy(false));
    }, 250);
  };
  const update = (patch: Partial<Params>) => {
    const next = { ...params, ...patch };
    setParams(next);
    rebuild(next, sheets);
  };

  const read = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await api.POST("/codelists/read", {
        body: { file: f.name },
        bodySerializer: () => {
          const form = new FormData();
          form.append("file", f, f.name);
          return form;
        },
      });
      const read = data!.sheets;
      if (!read.length) return;
      const next = paramsFromGuess(0, read[0]!.guess as unknown as TableColumnGuess);
      setFileName(f.name);
      setSheets(read);
      setParams(next);
      rebuild(next, read);
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  };

  const sheet = sheets[params.sheetIdx];
  const { headerRow, mapping, hierarchy, separator } = params;
  const width = sheet ? Math.max(0, ...sheet.rows.slice(0, 50).map((r) => r.length)) : 0;
  const head = sheet?.rows[headerRow] ?? [];
  const colLabel = (i: number) => t("column", { letter: letter(i), header: head[i] || "", hasHeader: head[i] ? "yes" : "no" });
  const cols = Array.from({ length: width }, (_, i) => i);
  const roleOf = (i: number) => ROLES.find((r) => mapping[r] === i);
  const setCol = (role: Role, v: string) => update({ mapping: { ...mapping, [role]: v === "" ? undefined : Number(v) } });
  const colSelect = (role: Role, optional: boolean) => (
    <select className={inputClass} value={mapping[role] ?? ""} onChange={(e) => setCol(role, e.target.value)} data-testid={`code-import-col-${role}`}>
      {optional && <option value="">{t("none")}</option>}
      {!optional && mapping[role] === undefined && <option value="">{t("choose")}</option>}
      {cols.map((i) => (
        <option key={i} value={i}>
          {colLabel(i)}
        </option>
      ))}
    </select>
  );

  const apply = () => {
    if (!result) return;
    onImport(mergeCodes(list, result.codes, mode, hierarchy === "separator" && separator ? separator : null));
  };

  const fileInput = (
    <input
      ref={file}
      type="file"
      accept=".xlsx,.xlsm,.csv,.tsv,.txt"
      hidden
      data-testid="code-import-file"
      onChange={(e) => {
        void read(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );
  const errorLine = error && (
    <p className="text-error" role="alert" data-testid="code-import-error">
      {error}
    </p>
  );

  if (!sheet)
    return (
      <div className="flex flex-col gap-3" data-testid="code-import-panel">
        <h3 className="text-base font-semibold">{t("title")}</h3>
        <p className="text-muted-foreground">{t("hint")}</p>
        <div
          role="button"
          tabIndex={0}
          aria-busy={busy}
          className="flex cursor-pointer flex-col items-center gap-1 rounded-[var(--radius)] border border-dashed border-input p-8 text-center hover:bg-muted"
          onClick={() => file.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && file.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void read(e.dataTransfer.files[0]);
          }}
        >
          <strong>{busy ? t("reading") : t("drop")}</strong>
          <span className="text-muted-foreground">{t("orClick")}</span>
        </div>
        {fileInput}
        {errorLine}
        <button type="button" className={cn(linkButton, "self-start")} onClick={onCancel}>
          {t("cancel")}
        </button>
      </div>
    );

  const preview = sheet.rows.slice(headerRow, headerRow + PREVIEW_ROWS);
  return (
    <div className="flex flex-col gap-4" data-testid="code-import-panel">
      <h3 className="text-base font-semibold">{t.rich("titleFile", { name: fileName ?? "", mono: (c) => <span className="font-mono">{c}</span> })}</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {sheets.length > 1 && (
          <Field label={t("sheet")}>
            <select
              className={inputClass}
              value={params.sheetIdx}
              onChange={(e) => {
                const i = Number(e.target.value);
                const next = paramsFromGuess(i, sheets[i]!.guess as unknown as TableColumnGuess);
                setParams(next);
                rebuild(next, sheets);
              }}
            >
              {sheets.map((s, i) => (
                <option key={i} value={i}>
                  {t("sheetOption", { name: s.name, n: s.rows.length })}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={t("headerRow")} hint={t("headerRowHint")}>
          <input
            type="number"
            className={cn(inputClass, "tabular-nums")}
            min={1}
            max={sheet.rows.length}
            value={headerRow + 1}
            onChange={(e) => update({ headerRow: Math.max(0, Math.min(sheet.rows.length - 1, Number(e.target.value) - 1)) })}
          />
        </Field>
        <Field label={t("codeColumn")}>{colSelect("code", false)}</Field>
        <Field label={t("titleColumn")}>{colSelect("title", false)}</Field>
        <Field label={t("descriptionColumn")} hint={t("descriptionColumnHint")}>
          {colSelect("description", true)}
        </Field>
        <Field label={t("hierarchy")}>
          <Select value={hierarchy} options={HIERARCHIES} labels={(h) => t(`hierarchies.${h}`)} onChange={(h) => update({ hierarchy: h ?? "flat" })} data-testid="code-import-hierarchy" />
        </Field>
        {hierarchy === "separator" && (
          <Field label={t("separator")} hint={t("separatorHint")}>
            <input type="text" className={cn(inputClass, "font-mono")} value={separator} maxLength={3} onChange={(e) => update({ separator: e.target.value })} placeholder={t("separatorPlaceholder")} />
          </Field>
        )}
        {hierarchy === "parent" && <Field label={t("parentColumn")}>{colSelect("parent", false)}</Field>}
        {hierarchy === "level" && <Field label={t("levelColumn")}>{colSelect("level", false)}</Field>}
      </div>

      <div className="flex flex-col gap-1">
        <div className="overflow-x-auto rounded-[var(--radius)] border border-border">
          <table className="w-full text-ui">
            <thead>
              <tr className="border-b border-border">
                {cols.map((i) => {
                  const role = roleOf(i);
                  return (
                    <th key={i} className={cn("label-caps px-2 py-1 text-left font-medium whitespace-nowrap text-muted-foreground", role && "bg-selection text-foreground")}>
                      {letter(i)}
                      {role && <span className="ml-2 rounded-[var(--radius)] border border-link px-1 text-link">{t(`roles.${role}`)}</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {preview.map((r, n) => (
                <tr key={n} className={cn("border-b border-border last:border-0", n === 0 && "font-semibold")}>
                  {cols.map((i) => (
                    <td key={i} className={cn("max-w-64 truncate px-2 py-1", roleOf(i) && "bg-selection")}>
                      {r[i]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground tabular-nums">{t("previewRows", { from: headerRow + 1, to: headerRow + preview.length, total: sheet.rows.length })}</p>
      </div>

      {errorLine}
      {result && (
        <div className="flex flex-col gap-2 border-t border-border pt-3" data-testid="code-import-result">
          <p>{t.rich("stats", { codes: result.stats.codes, top: result.stats.top, levels: result.stats.levels, b: (c) => <b>{c}</b> })}</p>
          {result.problems.length > 0 && (
            <ul className="list-disc rounded-[var(--radius)] border-l-2 border-attention py-1 pl-6" data-testid="code-import-problems">
              {result.problems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )}
          <div className="flex max-h-80 flex-col overflow-auto rounded-[var(--radius)] border border-border p-2">
            {result.codes.slice(0, PREVIEW_CODES).map((c) => (
              <div key={c.code} style={{ paddingLeft: (c.level ?? 0) * 18 }} className={cn(!c.level && "font-semibold")}>
                <span className="mr-2 font-mono">{c.code}</span>
                {c.title || <span className="text-muted-foreground">{t("noTitle")}</span>}
              </div>
            ))}
            {result.codes.length > PREVIEW_CODES && <div className="text-muted-foreground">{t("more", { n: result.codes.length - PREVIEW_CODES })}</div>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {list.codes.length > 0 && (
          <div className="w-80">
            <Select value={mode} options={["merge", "replace"] as const} labels={{ merge: t("merge"), replace: t("replace") }} onChange={(m) => setMode(m ?? "merge")} aria-label={t("modeLabel")} data-testid="code-import-mode" />
          </div>
        )}
        <Button type="button" disabled={!result || result.stats.codes === 0} onClick={apply} data-testid="code-import-apply">
          {t("apply", { n: result?.stats.codes ?? 0 })}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            clearTimeout(timer.current);
            seq.current++;
            setSheets([]);
            setResult(null);
            setError(null);
          }}
        >
          {t("another")}
        </Button>
        <button type="button" className={linkButton} onClick={onCancel}>
          {t("cancel")}
        </button>
        {busy && <span className="text-muted-foreground">{t("working")}</span>}
      </div>
    </div>
  );
}
