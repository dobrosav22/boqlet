"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { adminOrgsCsv, useAdminOrgs, type AdminFunnelStep, type AdminOrgFilters, type AdminOrgRow } from "@/api/hooks/admin";
import { saveFile } from "@/api/hooks/exports";
import { usePlans } from "@/api/hooks/models";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const SIGNALS = ["hit_limit", "inactive_30d", "trial_ending_7d", "stuck_in_setup"] as const;
const STATUSES = ["active", "suspended", "trialing"] as const;
const SORTABLE = ["name", "planId", "seats", "activeProjects", "processingMinutes", "limitHits30d", "lastActivityAt", "createdAt"] as const;

/** Debounced value, so typing in the search box doesn't ask the server on every key. */
function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/**
 * S36 orgs (F19 §3): filters (plan, status, country, tag, signal; a funnel step from the funnel),
 * search, sort by a column, CSV with the same filters. Filters live in the URL, so a view can be shared.
 */
export function AdminOrgsTable() {
  const t = useTranslations("admin.orgs");
  const tf = useTranslations("admin.funnel");
  const format = useFormatter();
  const message = useErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const plans = usePlans();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [country, setCountry] = useState(params.get("country") ?? "");
  const [tag, setTag] = useState(params.get("tag") ?? "");
  const debounced = useDebounced({ q, country, tag });

  const filters: AdminOrgFilters = useMemo(
    () => ({
      plan: params.get("plan") ?? undefined,
      status: params.get("status") ?? undefined,
      signal: (params.get("signal") as AdminOrgFilters["signal"]) ?? undefined,
      stuckAt: (params.get("stuckAt") as AdminFunnelStep | null) ?? undefined,
      sort: params.get("sort") ?? "-createdAt",
      q: debounced.q.trim() || undefined,
      country: debounced.country.trim() || undefined,
      tag: debounced.tag.trim() || undefined,
    }),
    [params, debounced],
  );
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  };
  const orgs = useAdminOrgs(filters);
  const rows = orgs.data?.pages.flatMap((p) => p.items) ?? [];
  const csv = useMutation({ mutationFn: async () => saveFile(await adminOrgsCsv(filters), t("csvFile")), onError: () => {} });

  const sort = filters.sort!;
  const sortKey = sort.replace(/^-/, "");
  const toggleSort = (key: string) => setParam("sort", sortKey === key && !sort.startsWith("-") ? `-${key}` : key);
  const usedOf = (x: { used?: number; max?: number | null } | undefined) =>
    t("usedOf", { used: format.number(x?.used ?? 0, { maximumFractionDigits: 1 }), max: x?.max === null || x?.max === undefined ? t("unlimited") : format.number(x.max) });
  const date = (d: string | null | undefined) => (d ? format.dateTime(new Date(d), { dateStyle: "medium" }) : t("never"));
  const statusText = (r: AdminOrgRow) => (r.status === "suspended" ? t("statuses.suspended") : r.subscriptionStatus === "trialing" ? t("statuses.trialing") : t("statuses.active"));

  const head = (key: (typeof SORTABLE)[number] | "country" | "status" | "ownerEmail" | "tags", right = false) => {
    const sortable = (SORTABLE as readonly string[]).includes(key);
    return (
      <TableHead className={right ? "text-right" : undefined} aria-sort={sortKey === key ? (sort.startsWith("-") ? "descending" : "ascending") : undefined}>
        {sortable ? (
          <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(key)} aria-label={t("sortBy", { column: t(`columns.${key}`) })} data-testid={`orgs-sort-${key}`}>
            {t(`columns.${key}`)}
            {sortKey === key && (sort.startsWith("-") ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUp className="size-3" aria-hidden />)}
          </button>
        ) : (
          t(`columns.${key}`)
        )}
      </TableHead>
    );
  };

  return (
    <div className="flex flex-col gap-4" data-testid="admin-orgs">
      <h1 className="text-title">{t("title")}</h1>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-64 flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("search")}</span>
          <Input value={q} onChange={(e) => setQ(e.target.value)} type="search" data-testid="orgs-search" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("plan")}</span>
          <NativeSelect value={filters.plan ?? ""} onChange={(e) => setParam("plan", e.target.value || null)} data-testid="orgs-plan">
            <option value="">{t("anyPlan")}</option>
            {(plans.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("status")}</span>
          <NativeSelect value={filters.status ?? ""} onChange={(e) => setParam("status", e.target.value || null)} data-testid="orgs-status">
            <option value="">{t("anyStatus")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`statuses.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex w-28 flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("country")}</span>
          <Input value={country} onChange={(e) => setCountry(e.target.value)} data-testid="orgs-country" />
        </label>
        <label className="flex w-32 flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("tag")}</span>
          <Input value={tag} onChange={(e) => setTag(e.target.value)} data-testid="orgs-tag" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("signal")}</span>
          <NativeSelect value={filters.signal ?? ""} onChange={(e) => setParam("signal", e.target.value || null)} data-testid="orgs-signal">
            <option value="">{t("anySignal")}</option>
            {SIGNALS.map((s) => (
              <option key={s} value={s}>
                {t(`signals.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <div className="flex-1" />
        <Button variant="outline" onClick={() => csv.mutate()} disabled={csv.isPending} data-testid="orgs-csv">
          <Download aria-hidden />
          {t("csv")}
        </Button>
      </div>
      {filters.stuckAt && (
        <p className="flex items-center gap-3" data-testid="orgs-stuck-at">
          <span>{t("stuckAt", { step: tf(`steps.${filters.stuckAt}`) })}</span>
          <button type="button" className="text-link underline-offset-4 hover:underline" onClick={() => setParam("stuckAt", null)}>
            {t("clearStuck")}
          </button>
        </p>
      )}
      {orgs.isError && (
        <p role="alert" className="text-error">
          {message(orgs.error)}
        </p>
      )}
      {orgs.isPending && <div className="h-40" aria-busy="true" />}
      {orgs.data && rows.length === 0 && <p className="text-muted-foreground">{t("none")}</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <Table data-testid="orgs-table">
            <TableHeader>
              <TableRow>
                {head("name")}
                {head("country")}
                {head("planId")}
                {head("status")}
                {head("seats", true)}
                {head("activeProjects", true)}
                {head("processingMinutes", true)}
                {head("limitHits30d", true)}
                {head("lastActivityAt")}
                {head("createdAt")}
                {head("ownerEmail")}
                {head("tags")}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} data-testid={`orgs-row-${r.id}`}>
                  <TableCell>
                    <Link href={`/admin/orgs/${r.id}`} className="text-link underline-offset-4 hover:underline">
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell>{r.country}</TableCell>
                  <TableCell>{r.planId}</TableCell>
                  <TableCell>
                    {statusText(r)}
                    {r.subscriptionStatus === "trialing" && r.trialEndsAt && <span className="text-muted-foreground"> · {date(r.trialEndsAt)}</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" data-testid="orgs-seats">
                    {usedOf(r.seats)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" data-testid="orgs-projects">
                    {usedOf(r.activeProjects)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" data-testid="orgs-minutes">
                    {usedOf(r.processingMinutes)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" data-testid="orgs-limit-hits">
                    {format.number(r.limitHits30d ?? 0)}
                  </TableCell>
                  <TableCell>{date(r.lastActivityAt)}</TableCell>
                  <TableCell>{date(r.createdAt)}</TableCell>
                  <TableCell>{r.ownerEmail}</TableCell>
                  <TableCell>{(r.tags ?? []).join(", ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {orgs.hasNextPage && (
        <Button variant="outline" className="self-start" onClick={() => orgs.fetchNextPage()} disabled={orgs.isFetchingNextPage}>
          {t("more")}
        </Button>
      )}
    </div>
  );
}
