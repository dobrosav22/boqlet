"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Box, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { Param } from "@ifc-boq/types";
import type { Run } from "@/api/hooks/boqs";
import { useLine, useLines, usePresetVersion } from "@/api/hooks/sheet";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { lexicon, toReadable } from "@/features/library/lib/readable";
import { useOrg } from "@/features/orgs/org-context";
import { HowCalculated } from "./how-calculated";
import { displayUnit } from "./model";
import { SourceTag } from "./source-tag";

/** "… (from slot formwork_walls_formula)": the engine names the setting a formula came from. */
const FROM_SLOT = /\s*\(from slot ([A-Za-z0-9_]+)\)\s*$/;

/**
 * The line detail (F06 §5): quantity and source, the formula in words (the PoC's readable
 * formulas) and as written, the settings used, every element's share with their total, the source
 * line of a derived line, codes per system, location, notes and the line's log entries. It starts
 * with the plain-words "How it is calculated" (FE-013), before any formula.
 */
export function LineDetailPanel({
  run,
  lineKey,
  showIn3dHref,
  modelNames,
  systemNames,
  onSelect,
  onClose,
  children,
}: {
  run: Run;
  lineKey: string;
  /** "Show in 3D" (F06 §5, F07 §7): the Viewer tab on this line's elements. */
  showIn3dHref?: string;
  modelNames: Map<string, string>;
  systemNames: Map<string, string>;
  onSelect: (key: string) => void;
  onClose: () => void;
  /** The line's edits and actions (F06 §6), above its explanation. */
  children?: React.ReactNode;
}) {
  const t = useTranslations("boqs.detail");
  const tl = useTranslations("library");
  const format = useFormatter();
  const message = useErrorMessage();
  const { org } = useOrg();
  const detail = useLine(run.id, lineKey);
  const lines = useLines(run.id);
  const descriptions = useMemo(() => new Map((lines.data ?? []).map((l) => [l.key, l.description])), [lines.data]);
  const ruleSet = usePresetVersion(run.snapshotVersions?.ruleSetVersionId);
  const slots = useMemo(() => {
    const doc = (ruleSet.data?.flattened ?? ruleSet.data?.doc) as { params?: Record<string, Param> } | undefined;
    return doc?.params ?? {};
  }, [ruleSet.data]);
  const lex = useMemo(() => lexicon(slots, (name) => (tl.has(`names.${name}.label`) ? tl(`names.${name}.label`) : name)), [slots, tl]);
  const num = (v: number) => format.number(v, { maximumFractionDigits: 6 });
  const value = (v: unknown) => (typeof v === "boolean" ? (v ? t("yes") : t("no")) : typeof v === "number" ? num(v) : typeof v === "string" ? v : JSON.stringify(v));
  const presetId = ruleSet.data?.presetId;
  const libraryHref = presetId ? `/${org.slug}/library/rule_set/${presetId}` : null;
  const slotLabel = (name: string) => lex.slotLabels.get(name) ?? slots[name]?.label ?? name;

  return (
    <aside className="flex w-full flex-col gap-5 border-l border-border pl-5 lg:w-[440px] lg:shrink-0" aria-label={t("title")} data-testid="line-detail">
      <div className="flex items-start gap-2">
        <h3 className="text-title flex-1">{detail.data?.description ?? ""}</h3>
        {showIn3dHref && (
          <Button variant="outline" render={<Link href={showIn3dHref} />} nativeButton={false} data-testid="show-in-3d">
            <Box aria-hidden />
            {t("showIn3d")}
          </Button>
        )}
        <Button variant="ghost" aria-label={t("close")} onClick={onClose} data-testid="close-detail">
          <X aria-hidden />
        </Button>
      </div>
      {children}
      {detail.isError && (
        <p role="alert" className="text-error">
          {message(detail.error)}
        </p>
      )}
      {!detail.data && !detail.isError && <div className="h-40" aria-busy="true" />}
      {detail.data &&
        (() => {
          const line = detail.data;
          const [, slot] = line.trace.formula.match(FROM_SLOT) ?? [];
          const formula = line.trace.formula.replace(FROM_SLOT, "");
          const elements = line.trace.elements;
          const sum = elements.reduce((s, e) => s + (e.quantity ?? 0), 0);
          const params = Object.entries(line.trace.params);
          return (
            <>
              <div className="flex items-baseline gap-3">
                <span className="text-title tabular-nums" data-testid="detail-quantity">
                  {line.quantity === null ? "—" : num(line.quantity)} {displayUnit(line.unit)}
                </span>
                <SourceTag source={line.source} />
              </div>

              <Section title={t("howCalculated")}>
                <HowCalculated line={line} slots={slots} lex={lex} libraryHref={libraryHref} modelNames={modelNames} describe={(key) => descriptions.get(key)} onSelect={onSelect} />
              </Section>

              <Section title={t("formula")}>
                <p className="text-prose" data-testid="detail-formula">
                  {toReadable(formula, lex)}
                </p>
                {slot && <p className="text-muted-foreground">{t("fromSetting", { name: slotLabel(slot) })}</p>}
                <p className="font-mono text-muted-foreground">
                  <span className="label-caps mr-2">{t("rawFormula")}</span>
                  <code data-testid="detail-raw-formula">{line.trace.formula}</code>
                </p>
                {line.trace.sourceLine && (
                  <p>
                    <span className="label-caps mr-2 text-muted-foreground">{t("derivedFrom")}</span>
                    <button className="text-link hover:underline" onClick={() => onSelect(line.trace.sourceLine!)} data-testid="detail-source-line">
                      {line.trace.sourceLine}
                    </button>
                  </p>
                )}
              </Section>

              <Section title={t("parameters")}>
                {params.length === 0 ? (
                  <p className="text-muted-foreground">{t("noParameters")}</p>
                ) : (
                  <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1" data-testid="detail-params">
                    {params.map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt title={k}>{slotLabel(k)}</dt>
                        <dd className="text-right tabular-nums">{value(v)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </Section>

              <Section title={t("elements")}>
                {elements.length === 0 ? (
                  <p className="text-muted-foreground">{t("noElements")}</p>
                ) : (
                  <table className="w-full" data-testid="detail-elements">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="label-caps py-1 font-medium">{t("element")}</th>
                        <th className="label-caps py-1 text-right font-medium">{t("share")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {elements.map((e, i) => (
                        <tr key={e.guid + i} className="border-b border-border align-top" data-testid="detail-element">
                          <td className="py-1 pr-2">
                            <div title={e.guid}>{e.name || e.guid}</div>
                            <div className="text-muted-foreground">
                              {e.model ? (modelNames.get(e.model) ?? e.model.slice(0, 8)) : null}
                              {e.note ? ` · ${e.note}` : null}
                            </div>
                          </td>
                          <td className="py-1 text-right tabular-nums" data-testid="detail-share">
                            {e.quantity === null ? t("missing") : num(e.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="py-1">{t("sumOfShares", { count: elements.length })}</td>
                        <td className="py-1 text-right font-semibold tabular-nums" data-testid="detail-share-sum">
                          {num(sum)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </Section>

              {Object.keys(line.codes).length > 0 && (
                <Section title={t("codes")}>
                  <ul className="flex flex-col gap-1" data-testid="detail-codes">
                    {Object.values(line.codes).map((c) => (
                      <li key={c.system}>
                        <span className="label-caps mr-2 text-muted-foreground">{systemNames.get(c.system) ?? c.system}</span>
                        <span className="font-semibold">{c.code}</span> {c.title}{" "}
                        <span className="text-muted-foreground">({c.mapRuleId ? t("mapRule", { id: c.mapRuleId }) : t(`codeSource.${c.source}`)})</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {(line.location?.storey || line.location?.storeys?.length) && (
                <Section title={t("location")}>
                  <p>{line.location?.storey ?? line.location?.storeys?.join(", ")}</p>
                </Section>
              )}
              {line.notes.length > 0 && (
                <Section title={t("notes")}>
                  <ul className="list-disc pl-4">
                    {line.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </Section>
              )}
              {line.tags.length > 0 && (
                <Section title={t("tags")}>
                  <p>{line.tags.join(", ")}</p>
                </Section>
              )}

              <Section title={t("log")}>
                {(line.log ?? []).length === 0 ? (
                  <p className="text-muted-foreground">{t("noLog")}</p>
                ) : (
                  <ol className="flex flex-col gap-1" data-testid="detail-log">
                    {line.log!.map((e) => (
                      <li key={e.seq} className="flex gap-2">
                        <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">{e.seq}</span>
                        <span className={e.level === "warning" ? "border-l-2 border-[var(--status-attention)] pl-2" : undefined}>{e.message}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>
            </>
          );
        })()}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="label-caps text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}
