"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useAdminFunnel, type AdminFunnelStep } from "@/api/hooks/admin";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PeriodSelect, usePeriod } from "./period-select";

/** Steps where a list of organisations makes sense (an org exists from "Organisation created" on). */
const LISTABLE: AdminFunnelStep[] = ["setup_done", "first_model_ready", "first_boq", "first_saved_version", "first_export_or_share"];

/** S36 funnel (F19 §2): count, conversion and median time per step; cohorts by sign-up week. */
export function AdminFunnelView() {
  const t = useTranslations("admin.funnel");
  const format = useFormatter();
  const message = useErrorMessage();
  const period = usePeriod();
  const funnel = useAdminFunnel(period.period);
  const duration = (h: number | null | undefined) =>
    h === null || h === undefined ? "—" : h >= 48 ? t("days", { n: format.number(h / 24, { maximumFractionDigits: 1 }) }) : t("hours", { n: format.number(h, { maximumFractionDigits: 1 }) });
  const steps = funnel.data?.steps ?? [];
  return (
    <div className="flex flex-col gap-6" data-testid="admin-funnel">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-title">{t("title")}</h1>
          <p className="prose-text text-muted-foreground">{t("intro")}</p>
        </div>
        <PeriodSelect state={period} />
      </div>
      {funnel.isError && (
        <p role="alert" className="text-error">
          {message(funnel.error)}
        </p>
      )}
      {!funnel.data && !funnel.isError && <div className="h-40" aria-busy="true" />}
      {funnel.data && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("step")}</TableHead>
                <TableHead className="text-right">{t("count")}</TableHead>
                <TableHead className="text-right">{t("conversion")}</TableHead>
                <TableHead className="text-right">{t("median")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {steps.map((s) => (
                <TableRow key={s.step} data-testid={`funnel-${s.step}`}>
                  <TableCell>{t(`steps.${s.step}`)}</TableCell>
                  <TableCell className="text-right tabular-nums" data-testid={`funnel-${s.step}-count`}>
                    {format.number(s.orgs)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.conversionPct === undefined ? "—" : format.number(s.conversionPct / 100, { style: "percent", maximumFractionDigits: 1 })}</TableCell>
                  <TableCell className="text-right tabular-nums">{duration(s.medianHoursFromPrevious)}</TableCell>
                  <TableCell className="text-right">
                    {LISTABLE.includes(s.step) && (
                      <Link href={`/admin/orgs?stuckAt=${s.step}`} className="text-link underline-offset-4 hover:underline" data-testid={`funnel-${s.step}-stuck`}>
                        {t("stuck")}
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(funnel.data.cohorts ?? []).length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="label-caps">{t("cohorts")}</h2>
              <Table data-testid="funnel-cohorts">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("week")}</TableHead>
                    {steps.map((s) => (
                      <TableHead key={s.step} className="text-right">
                        {t(`steps.${s.step}`)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(funnel.data.cohorts ?? []).map((c) => (
                    <TableRow key={c.week}>
                      <TableCell className="tabular-nums">{c.week}</TableCell>
                      {(c.counts ?? []).map((n, i) => (
                        <TableCell key={i} className="text-right tabular-nums">
                          {format.number(n)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>
          )}
        </>
      )}
    </div>
  );
}
