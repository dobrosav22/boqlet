"use client";

/**
 * The Code list tab (the PoC's `CodesTab` and `AboutList`): the codes as a tree, edited in place,
 * with "About this list" and the spreadsheet import. Big lists (Uniclass has thousands of codes)
 * are filtered and shown a page at a time, so only one page of rows is ever in the DOM.
 */
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { CodeList } from "@ifc-boq/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { put, removeAt, replaceAt } from "../shared/doc";
import { Check, Field, LazyText, Section, Select, StringList, Text, inputClass, linkButton, matches } from "../shared/fields";
import { CodeImport } from "./code-import";
import { newCode, pageOf, PAGE_SIZE, renameCode, treeOrder } from "./model";
import { NavLink } from "./nav";

export function CodesTab({ list, onChange, usage, onRenameId }: { list: CodeList; onChange: (cl: CodeList) => void; usage: Record<string, string[]>; onRenameId: (id: string) => void }) {
  const t = useTranslations("classificationEditor.codes");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const codes = list.codes;
  const sep = list.separator;
  const [importing, setImporting] = useState(codes.length === 0);
  const setCodes = (c: CodeList["codes"]) => onChange({ ...list, codes: c });

  const ordered = useMemo(() => treeOrder(codes, sep), [codes, sep]);
  const shown = useMemo(() => (q ? ordered.filter(({ c }) => matches(q, c.code, c.title)) : ordered), [ordered, q]);
  const { rows, current, pages, from } = pageOf(shown, page);

  /** Add a code and turn to the page that shows it. */
  const add = (parent?: string) => {
    const next = [...codes, newCode(codes, sep, parent, t("newTitle"))];
    const at = treeOrder(next, sep).findIndex((r) => r.i === next.length - 1);
    setQ("");
    setPage(Math.floor(at / PAGE_SIZE));
    setCodes(next);
  };

  if (importing)
    return (
      <CodeImport
        list={list}
        onImport={(cl) => {
          onChange(cl);
          setImporting(false);
          setPage(0);
        }}
        onCancel={() => setImporting(false)}
      />
    );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">{t("hint", { hasSep: sep ? "yes" : "no", sep: sep ?? "" })}</p>
      <AboutList list={list} onChange={onChange} onRenameId={onRenameId} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          className={cn(inputClass, "w-64 flex-1")}
          placeholder={t("filter")}
          aria-label={t("filter")}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          data-testid="code-filter"
        />
        <Button type="button" variant="outline" onClick={() => add()} data-testid="code-add-top">
          {t("addTop")}
        </Button>
        <Button type="button" variant="outline" onClick={() => setImporting(true)} data-testid="code-import">
          {t("import")}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-ui" data-testid="code-table">
          <thead>
            <tr className="label-caps border-b border-border text-left text-muted-foreground">
              <th className="w-[35%] py-1 pr-2 font-medium">{t("headCode")}</th>
              <th className="py-1 pr-2 font-medium">{t("headTitle")}</th>
              <th className="w-[20%] py-1 pr-2 font-medium">{t("headUsage")}</th>
              <th className="w-28 py-1 font-medium">
                <span className="sr-only">{t("headActions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, i, depth }) => (
              <tr key={i} className={cn("border-b border-border align-top", depth === 0 && "font-semibold")} data-testid="code-row" data-code={c.code}>
                <td className="py-1 pr-2">
                  <div style={{ paddingLeft: depth * 18 }}>
                    <LazyText mono value={c.code} aria-label={t("codeLabel")} onCommit={(v) => v.trim() && setCodes(renameCode(codes, i, v.trim()))} />
                  </div>
                </td>
                <td className="py-1 pr-2">
                  <LazyText value={c.title} aria-label={t("titleLabel", { code: c.code })} onCommit={(v) => setCodes(replaceAt(codes, i, { ...c, title: v }))} />
                </td>
                <td className="py-1.5 pr-2 font-normal break-words">{usage[c.code]?.join(t("comma")) ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="py-1.5 font-normal whitespace-nowrap">
                  <button type="button" className={linkButton} onClick={() => add(c.code)}>
                    {t("addChild")}
                  </button>
                  <button type="button" className="ml-3 text-muted-foreground hover:text-foreground" aria-label={t("delete", { code: c.code })} onClick={() => setCodes(removeAt(codes, i))}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="py-2 text-muted-foreground">{codes.length ? t("noMatch") : t("empty")}</p>}
      </div>
      {shown.length > PAGE_SIZE && (
        <div className="flex items-center gap-3" data-testid="code-pages">
          <NavLink onClick={() => setPage(current - 1)} aria-disabled={current === 0} data-testid="code-page-prev">
            {t("prev")}
          </NavLink>
          <span className="text-muted-foreground tabular-nums">{t("pageOf", { from, to: from + rows.length - 1, total: shown.length })}</span>
          <NavLink onClick={() => setPage(current + 1)} aria-disabled={current >= pages - 1} data-testid="code-page-next">
            {t("next")}
          </NavLink>
        </div>
      )}
    </div>
  );
}

const KINDS = ["official", "company", "client", "other"] as const satisfies readonly CodeList["kind"][];

/** Name, publisher, levels, licence: folded, as they are set once. */
function AboutList({ list: cl, onChange: setCl, onRenameId }: { list: CodeList; onChange: (cl: CodeList) => void; onRenameId: (id: string) => void }) {
  const t = useTranslations("classificationEditor.about");
  const lic = cl.licence;
  const summary = [
    t(`kinds.${cl.kind}`),
    cl.publisher,
    cl.version,
    cl.levels?.length ? t("summaryLevels", { levels: cl.levels.join(" › ") }) : "",
    lic ? t("summaryLicence", { name: lic.name }) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <details className="rounded-[var(--radius)] border border-border p-3" data-testid="about-list">
      <summary className="cursor-pointer">
        <span className="font-semibold">{t("title")}</span>
        <span className="ml-2 text-muted-foreground">{summary}</span>
      </summary>
      <div className="mt-3 flex flex-col gap-4">
        <Section title={t("theList")}>
          <Field label={t("name")}>
            <Text value={cl.name} onChange={(v) => setCl({ ...cl, name: v ?? "" })} optional={false} />
          </Field>
          <Field label={t("kind")}>
            <Select value={cl.kind} options={KINDS} labels={(k) => t(`kindOptions.${k}`)} onChange={(v) => setCl({ ...cl, kind: v ?? "company" })} />
          </Field>
          <Field label={t("publisher")}>
            <Text value={cl.publisher} onChange={(v) => setCl(put(cl, "publisher", v))} />
          </Field>
          <Field label={t("version")}>
            <Text value={cl.version} onChange={(v) => setCl(put(cl, "version", v))} />
          </Field>
          <Field label={t("language")}>
            <Text value={cl.locale} onChange={(v) => setCl(put(cl, "locale", v))} placeholder={t("languagePlaceholder")} />
          </Field>
          <Field label={t("separator")} hint={t("separatorHint")}>
            <Text mono value={cl.separator} onChange={(v) => setCl(put(cl, "separator", v))} placeholder={t("none")} />
          </Field>
          <Field label={t("levels")} group hint={t("levelsHint")}>
            <StringList values={cl.levels} onChange={(v) => setCl(put(cl, "levels", v))} placeholder={t("levelsPlaceholder")} />
          </Field>
          <Field label={t("id")} hint={t("idHint")}>
            <Text mono value={cl.id} onChange={(v) => onRenameId(v ?? "")} optional={false} />
          </Field>
        </Section>
        <Section title={t("licence")} hint={t("licenceHint")}>
          {lic ? (
            <>
              <Field label={t("licenceName")}>
                <Text value={lic.name} onChange={(v) => setCl({ ...cl, licence: { ...lic, name: v ?? "" } })} optional={false} />
              </Field>
              <Field label={t("url")}>
                <Text value={lic.url} onChange={(v) => setCl({ ...cl, licence: put(lic, "url", v) })} />
              </Field>
              <Field label={t("attribution")}>
                <Text value={lic.attribution} onChange={(v) => setCl({ ...cl, licence: put(lic, "attribution", v) })} />
              </Field>
              <Field label={t("passingOn")} group>
                <Check checked={lic.redistributable} onChange={(v) => setCl({ ...cl, licence: { ...lic, redistributable: v } })} label={t("redistributable")} />
              </Field>
            </>
          ) : (
            <Field label={t("licenceName")} group>
              <button type="button" className={cn(linkButton, "self-start")} onClick={() => setCl({ ...cl, licence: { name: t("internal"), redistributable: false } })}>
                {t("addLicence")}
              </button>
            </Field>
          )}
        </Section>
      </div>
    </details>
  );
}
