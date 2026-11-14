"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useAdminOverview } from "@/api/hooks/admin";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { PeriodSelect, usePeriod } from "./period-select";
import { Sparkline } from "./sparkline";

/** The tiles in the order F19 §1 lists them; modules add theirs through `admin.metrics` later (P36). */
const TILES = ["signUps", "newOrgs", "activeOrgs", "payingOrgs", "revenue", "seatsUsed", "seatsAvailable", "activeProjects", "modelsParsed", "runs", "processingMinutes", "exports", "savedVersions", "confirmedBoqs", "shareLinkViews"] as const;

/** S36 overview (F19 §1): a period, tiles with their trend, organisations by plan. */
export function AdminOverviewView() {
  const t = useTranslations("admin.overview");
  const format = useFormatter();
  const message = useErrorMessage();
  const period = usePeriod();
  const overview = useAdminOverview(period.period);
  const num = (v: number | null | undefined) => (v === null || v === undefined ? t("noValue") : format.number(v, { maximumFractionDigits: 1 }));
  return (
    <div className="flex flex-col gap-6" data-testid="admin-overview">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-title">{t("title")}</h1>
        <PeriodSelect state={period} />
      </div>
      {overview.isError && (
        <p role="alert" className="text-error">
          {message(overview.error)}
        </p>
      )}
      {!overview.data && !overview.isError && <div className="h-40" aria-busy="true" />}
      {overview.data && (
        <>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-px border border-border bg-border">
            {TILES.map((key) => {
              const tile = overview.data.tiles?.[key];
              return (
                <li key={key} className="flex flex-col gap-1 bg-background p-4" data-testid={`admin-tile-${key}`}>
                  <span className="label-caps text-muted-foreground">{t(`tiles.${key}`)}</span>
                  <span className="text-title tabular-nums" data-testid={`admin-tile-${key}-value`}>
                    {num(tile?.value)}
                  </span>
                  {key === "revenue" && (tile?.value ?? null) === null ? (
                    <span className="text-muted-foreground">{t("revenueNone")}</span>
                  ) : (
                    tile?.previous !== null && tile?.previous !== undefined && <span className="text-muted-foreground tabular-nums">{t("previous", { value: num(tile.previous) })}</span>
                  )}
                  {tile?.series && tile.series.length > 1 && <Sparkline values={tile.series} label={t(`tiles.${key}`)} />}
                </li>
              );
            })}
          </ul>
          <section className="flex flex-col gap-3">
            <h2 className="label-caps">{t("orgsByPlan")}</h2>
            <dl className="flex flex-wrap gap-10" data-testid="admin-orgs-by-plan">
              {Object.entries(overview.data.orgsByPlan ?? {}).map(([plan, n]) => (
                <div key={plan} className="flex flex-col">
                  <dt className="label-caps text-muted-foreground">{plan}</dt>
                  <dd className="text-title tabular-nums">{format.number(n)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}
    </div>
  );
}
