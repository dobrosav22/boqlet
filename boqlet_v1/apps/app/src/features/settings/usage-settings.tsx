"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEntitlements, useUsage } from "@/api/hooks/billing";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrg } from "@/features/orgs/org-context";

/** S24 (owner, admin): this month's processing minutes by project and by kind, seats, active projects. F14. */
export function UsageSettings() {
  const t = useTranslations("settings.usage");
  const format = useFormatter();
  const message = useErrorMessage();
  const { org, can } = useOrg();
  const usage = useUsage(org.id);
  const entitlements = useEntitlements(org.id);
  if (!can("seeUsage")) return <p className="text-muted-foreground">{t("notAllowed")}</p>;
  if (usage.isError) return <p role="alert" className="text-error">{message(usage.error)}</p>;
  if (!usage.data) return <div className="h-40" aria-busy="true" />;
  const u = usage.data;
  const ent = entitlements.data?.usage;
  const mins = (v: number) => t("minutes", { n: format.number(v, { maximumFractionDigits: 1 }) });
  return (
    <div className="flex max-w-3xl flex-col gap-8" data-testid="usage-settings">
      <dl className="flex flex-wrap gap-10">
        <Figure label={t("processing", { month: u.month })} value={mins(u.processingMinutes)} testId="usage-minutes" />
        {ent?.seats !== undefined && <Figure label={t("seats")} value={format.number(ent.seats)} testId="usage-seats" />}
        {ent?.activeProjects !== undefined && <Figure label={t("activeProjects")} value={format.number(ent.activeProjects)} testId="usage-projects" />}
      </dl>
      <section className="flex flex-col gap-3">
        <h3 className="label-caps">{t("byProject")}</h3>
        {u.byProject.length === 0 ? (
          <p className="text-muted-foreground">{t("none")}</p>
        ) : (
          <Table data-testid="usage-by-project">
            <TableHeader>
              <TableRow>
                <TableHead>{t("project")}</TableHead>
                <TableHead className="text-right">{t("time")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {u.byProject.map((p) => (
                <TableRow key={p.projectId}>
                  <TableCell>{p.projectName}</TableCell>
                  <TableCell className="text-right tabular-nums">{mins(p.minutes ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="label-caps">{t("byKind")}</h3>
        <dl className="flex flex-wrap gap-10" data-testid="usage-by-kind">
          {Object.entries(u.byKind).map(([kind, v]) => (
            <Figure key={kind} label={t.has(`kinds.${kind}`) ? t(`kinds.${kind}`) : kind} value={mins(v)} />
          ))}
        </dl>
      </section>
    </div>
  );
}

function Figure({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex flex-col" data-testid={testId}>
      <dt className="label-caps text-muted-foreground">{label}</dt>
      <dd className="text-title tabular-nums">{value}</dd>
    </div>
  );
}
