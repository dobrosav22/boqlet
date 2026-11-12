"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Run } from "@/api/hooks/boqs";
import { useLog, type LogFilters } from "@/api/hooks/sheet";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STAGES = ["parse", "names", "measure", "match", "quantity", "derived", "manual", "classify", "decision", "summary"] as const;
const LEVELS = ["info", "detail", "warning"] as const;

/** S12e: the run's calculation log, paged and filtered on the server (F06 §9). */
export function LogTab({ run }: { run: Run | undefined }) {
  const t = useTranslations("boqs.log");
  const message = useErrorMessage();
  const [filters, setFilters] = useState<LogFilters>({});
  const log = useLog(run?.id, filters);
  const set = (key: keyof LogFilters, value: string) => setFilters((f) => ({ ...f, [key]: value.trim() || undefined }));
  if (!run) return <p className="text-muted-foreground">{t("noRun")}</p>;
  const items = log.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="flex flex-col gap-4" data-testid="log-tab">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("stage")}</span>
          <NativeSelect value={filters.stage ?? ""} onChange={(e) => set("stage", e.target.value)} data-testid="log-stage">
            <option value="">{t("all")}</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {t(`stages.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("level")}</span>
          <NativeSelect value={filters.level ?? ""} onChange={(e) => set("level", e.target.value)} data-testid="log-level">
            <option value="">{t("all")}</option>
            {LEVELS.map((s) => (
              <option key={s} value={s}>
                {t(`levels.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("filterLine")}</span>
          <Input defaultValue="" onBlur={(e) => set("lineKey", e.target.value)} onKeyDown={(e) => e.key === "Enter" && set("lineKey", e.currentTarget.value)} data-testid="log-line" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("filterGuid")}</span>
          <Input defaultValue="" onBlur={(e) => set("guid", e.target.value)} onKeyDown={(e) => e.key === "Enter" && set("guid", e.currentTarget.value)} />
        </label>
      </div>
      {log.isError && (
        <p role="alert" className="text-error">
          {message(log.error)}
        </p>
      )}
      {log.data && items.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
      {items.length > 0 && (
        <table className="w-full" data-testid="log-table">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="label-caps w-14 py-1 pr-2 text-right font-medium">{t("seq")}</th>
              <th className="label-caps w-28 py-1 pr-2 font-medium">{t("stage")}</th>
              <th className="label-caps py-1 pr-2 font-medium">{t("message")}</th>
              <th className="label-caps w-48 py-1 font-medium">{t("lineKey")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.seq} className="border-b border-border align-top" data-testid="log-entry">
                <td className="py-1 pr-2 text-right tabular-nums text-muted-foreground">{e.seq}</td>
                <td className="py-1 pr-2">{t.has(`stages.${e.stage}`) ? t(`stages.${e.stage}`) : e.stage}</td>
                <td className={cn("py-1 pr-2", e.level === "warning" && "border-l-2 border-[var(--status-attention)] pl-2", e.level === "detail" && "text-muted-foreground")}>{e.message}</td>
                <td className="truncate py-1 text-muted-foreground" title={e.guid}>
                  {e.lineKey ?? e.ruleId ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {log.hasNextPage && (
        <Button variant="outline" className="self-start" onClick={() => log.fetchNextPage()} disabled={log.isFetchingNextPage} data-testid="log-more">
          {t("loadMore")}
        </Button>
      )}
    </div>
  );
}
