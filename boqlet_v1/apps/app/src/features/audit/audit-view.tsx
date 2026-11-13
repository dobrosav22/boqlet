"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { auditCsv, useAuditActors, useAuditPages, type AuditFilters, type AuditScope } from "@/api/hooks/audit";
import { saveFile } from "@/api/hooks/exports";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Actions the filter offers (F09 "Audit log", the minimum set and the ones the build writes). */
export const AUDIT_ACTIONS = [
  "org.created", "org.updated", "member.invited", "member.joined", "member.role_changed", "member.removed", "session.replaced",
  "project.created", "project.updated", "project.archived", "project.restored", "project.member_added", "project.member_removed",
  "model.created", "model.updated", "model_version.created", "model_version.deleted",
  "boq.created", "boq.updated", "boq.archived", "boq.restored", "boq.confirmed", "boq.reopened",
  "revision.created", "revision.inputs_changed", "revision.submitted", "revision.changes_requested", "revision.approved", "revision.reopened", "version.saved",
  "run.created", "run.finished", "run.failed", "decision.set", "decision.cleared", "decision.promoted",
  "line.edited", "line.restored", "manual_line.added", "manual_line.updated", "manual_line.removed",
  "export.created", "export.downloaded", "preset.created", "preset.published", "preset.archived", "org.setup_done",
] as const;

export const AUDIT_ENTITIES = ["org", "user", "project", "model", "modelVersion", "boq", "revision", "run", "decision", "export", "preset"] as const;

/** `yyyy-mm-dd` (a date input) → the start or the end of that day, as an ISO date-time. */
const dayBound = (day: string, end: boolean) => (day ? new Date(`${day}T${end ? "23:59:59.999" : "00:00:00.000"}`).toISOString() : undefined);

/**
 * The audit log (F09 "Audit log"): S18 for a project (leads and approvers), S25 for the org (owner,
 * admin). Filters by actor, action, entity and date; 100 events a page; the same filters as CSV.
 */
export function AuditView({ scope, fileName, projectHref }: { scope: AuditScope; fileName: string; projectHref?: (projectId: string) => string }) {
  const t = useTranslations("audit");
  const ta = useTranslations("projects.activity");
  const format = useFormatter();
  const message = useErrorMessage();
  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [fromDay, setFromDay] = useState("");
  const [toDay, setToDay] = useState("");
  const filters: AuditFilters = useMemo(
    () => ({ actorId, action, entityType, from: dayBound(fromDay, false), to: dayBound(toDay, true) }),
    [actorId, action, entityType, fromDay, toDay],
  );
  const pages = useAuditPages(scope, filters);
  const actors = useAuditActors(scope);
  const csv = useMutation({ mutationFn: async () => saveFile(await auditCsv(scope, filters), fileName), onError: () => {} });
  const items = pages.data?.pages.flatMap((p) => p.items) ?? [];
  const actionText = (a: string) => {
    const key = `actions.${a.replaceAll(".", "_")}`;
    return ta.has(key) ? ta(key) : a;
  };
  const entityText = (e: string) => (t.has(`entities.${e}`) ? t(`entities.${e}`) : e);
  const any = actorId || action || entityType || fromDay || toDay;

  return (
    <div className="flex flex-col gap-4" data-testid="audit-view">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("actor")}</span>
          <NativeSelect value={actorId} onChange={(e) => setActorId(e.target.value)} data-testid="audit-actor">
            <option value="">{t("anyone")}</option>
            {(actors.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("action")}</span>
          <NativeSelect value={action} onChange={(e) => setAction(e.target.value)} data-testid="audit-action">
            <option value="">{t("anyAction")}</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {actionText(a)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("entity")}</span>
          <NativeSelect value={entityType} onChange={(e) => setEntityType(e.target.value)} data-testid="audit-entity">
            <option value="">{t("anyEntity")}</option>
            {AUDIT_ENTITIES.map((e) => (
              <option key={e} value={e}>
                {entityText(e)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("from")}</span>
          <Input type="date" value={fromDay} onChange={(e) => setFromDay(e.target.value)} className="w-40" data-testid="audit-from" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("to")}</span>
          <Input type="date" value={toDay} onChange={(e) => setToDay(e.target.value)} className="w-40" data-testid="audit-to" />
        </label>
        {any && (
          <Button
            variant="ghost"
            onClick={() => {
              setActorId("");
              setAction("");
              setEntityType("");
              setFromDay("");
              setToDay("");
            }}
          >
            {t("clear")}
          </Button>
        )}
        <Button variant="outline" className="ml-auto" onClick={() => csv.mutate()} disabled={csv.isPending} data-testid="audit-csv">
          <Download aria-hidden />
          {t("csv")}
        </Button>
      </div>
      {(pages.error ?? csv.error) ? (
        <p role="alert" className="text-error">
          {message(pages.error ?? csv.error)}
        </p>
      ) : null}
      {pages.isPending && <div className="h-24" aria-busy="true" />}
      {pages.data && items.length === 0 && <p className="text-muted-foreground">{any ? t("noneFiltered") : ta("empty")}</p>}
      {items.length > 0 && (
        <Table data-testid="audit-table">
          <TableHeader>
            <TableRow>
              <TableHead className="label-caps">{t("when")}</TableHead>
              <TableHead className="label-caps">{t("actor")}</TableHead>
              <TableHead className="label-caps">{t("action")}</TableHead>
              <TableHead className="label-caps">{t("entity")}</TableHead>
              {scope.kind === "org" && <TableHead className="label-caps">{t("project")}</TableHead>}
              <TableHead className="label-caps">{t("details")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((e) => (
              <TableRow key={e.id} data-testid="audit-row" data-action={e.action}>
                <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{format.dateTime(new Date(e.at), { dateStyle: "medium", timeStyle: "short" })}</TableCell>
                <TableCell>{e.actor?.name ?? ta("system")}</TableCell>
                <TableCell>{actionText(e.action)}</TableCell>
                <TableCell className="text-muted-foreground">{entityText(e.entityType)}</TableCell>
                {scope.kind === "org" && (
                  <TableCell>
                    {e.projectId && projectHref ? (
                      <Link href={projectHref(e.projectId)} className="text-link hover:underline">
                        {t("open")}
                      </Link>
                    ) : null}
                  </TableCell>
                )}
                <TableCell className="max-w-[360px] truncate text-muted-foreground" title={JSON.stringify(e.data ?? {})}>
                  {details(e.data)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {pages.hasNextPage && (
        <Button variant="outline" className="self-start" onClick={() => pages.fetchNextPage()} disabled={pages.isFetchingNextPage} data-testid="audit-more">
          {t("more")}
        </Button>
      )}
    </div>
  );
}

/** A short line from an event's data: its values, in order (names, labels, reasons). */
function details(data: Record<string, unknown> | undefined) {
  return Object.values(data ?? {})
    .filter((v) => typeof v === "string" || typeof v === "number")
    .join(" · ");
}
