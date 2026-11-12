"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { Schemas } from "@ifc-boq/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Summary = Schemas["ModelSummary"];
interface CheckDetail {
  id: string;
  code: string;
  severity: "info" | "warning" | "error";
  elementIds: string[];
  message: string;
}

/**
 * The input-check report (F03 §5): storeys, counts by IFC class (sortable), and the checks grouped
 * by code with severity and the affected GlobalIds. Opening them in 3D comes with the viewer (FE-016).
 */
export function InputCheckReport({ summary }: { summary: Summary }) {
  const t = useTranslations("models.report");
  const format = useFormatter();
  const [sort, setSort] = useState<"count" | "class">("count");
  const classes = useMemo(() => {
    const rows = Object.entries(summary.byClass);
    return sort === "count" ? rows.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) : rows.sort((a, b) => a[0].localeCompare(b[0]));
  }, [summary.byClass, sort]);
  const groups = useMemo(() => {
    const details = (summary.checkDetails ?? []) as unknown as CheckDetail[];
    const byCode = new Map<string, { code: string; severity: string; count: number; elements: string[]; message: string }>();
    for (const [code, count] of Object.entries(summary.checks)) byCode.set(code, { code, severity: "warning", count, elements: [], message: "" });
    for (const d of details) {
      const g = byCode.get(d.code) ?? { code: d.code, severity: d.severity, count: 0, elements: [], message: d.message };
      g.severity = d.severity;
      g.message ||= d.message;
      g.elements.push(...d.elementIds);
      byCode.set(d.code, g);
    }
    return [...byCode.values()].sort((a, b) => b.count - a.count);
  }, [summary.checks, summary.checkDetails]);

  return (
    <div className="grid grid-cols-1 gap-10 xl:grid-cols-2" data-testid="input-check-report">
      <section className="flex flex-col gap-3">
        <h3 className="label-caps">{t("counts")}</h3>
        <dl className="flex flex-wrap gap-8">
          <Count label={t("elements")} value={format.number(summary.elementCount)} />
          <Count label={t("openings")} value={format.number(summary.openingCount ?? 0)} />
          <Count label={t("spaces")} value={format.number(summary.spaceCount ?? 0)} />
          <Count label={t("storeys")} value={format.number(summary.storeys?.length ?? 0)} />
        </dl>
        <Table data-testid="by-class">
          <TableHeader>
            <TableRow>
              <TableHead>
                <button type="button" className="label-caps hover:text-foreground" onClick={() => setSort("class")} aria-pressed={sort === "class"}>
                  {t("ifcClass")}
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button type="button" className="label-caps hover:text-foreground" onClick={() => setSort("count")} aria-pressed={sort === "count"}>
                  {t("count")}
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classes.map(([cls, n]) => (
              <TableRow key={cls}>
                <TableCell>{cls}</TableCell>
                <TableCell className="text-right tabular-nums">{format.number(n)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-3" data-testid="checks">
          <h3 className="label-caps">{t("checks")}</h3>
          {groups.length === 0 && <p>{t("noProblems")}</p>}
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {groups.map((g) => (
              <li key={g.code} className="flex flex-col gap-1 py-2" data-testid={`check-${g.code}`}>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "label-caps rounded-[var(--radius)] px-1",
                      g.severity === "error" ? "border border-[var(--status-error)] text-error" : g.severity === "warning" ? "bg-attention text-on-fill" : "border border-border",
                    )}
                  >
                    {t(`severity.${g.severity === "error" ? "error" : g.severity === "info" ? "info" : "warning"}`)}
                  </span>
                  <span className="flex-1">{t.has(`checkCodes.${g.code}`) ? t(`checkCodes.${g.code}`) : g.code}</span>
                  <span className="tabular-nums">{format.number(g.count)}</span>
                </div>
                {g.elements.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-muted-foreground">{t("affected", { n: g.elements.length })}</summary>
                    <p className="mt-1 break-all text-muted-foreground">{g.elements.slice(0, 50).join(" · ")}</p>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-3">
          <h3 className="label-caps">{t("storeys")}</h3>
          <ul className="flex flex-col divide-y divide-border">
            {(summary.storeys ?? []).map((s, i) => (
              <li key={`${s.name}-${i}`} className="flex justify-between py-1">
                <span>{s.name}</span>
                <span className="tabular-nums text-muted-foreground">{s.elevation !== undefined ? t("elevation", { m: format.number(s.elevation, { maximumFractionDigits: 2 }) }) : null}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Count({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="label-caps text-muted-foreground">{label}</dt>
      <dd className="text-title tabular-nums">{value}</dd>
    </div>
  );
}
