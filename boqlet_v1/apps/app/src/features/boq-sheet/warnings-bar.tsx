"use client";

import { useTranslations } from "next-intl";
import { useWarnings } from "@/api/hooks/sheet";

/** The run's warnings above the sheet (F06 §8), collapsible, each with its affected elements. */
export function WarningsBar({ runId }: { runId: string }) {
  const t = useTranslations("boqs.warnings");
  const warnings = useWarnings(runId);
  const list = warnings.data ?? [];
  if (list.length === 0) return null;
  return (
    <details className="border-l-2 border-[var(--status-attention)] pl-3" data-testid="warnings-bar">
      <summary className="cursor-pointer">{t("title", { count: list.length })}</summary>
      <ul className="mt-2 flex flex-col gap-1">
        {list.map((w, i) => (
          <li key={`${w.code}-${i}`} className="flex gap-3">
            <span className="flex-1">{w.message}</span>
            {w.guids?.length ? <span className="text-muted-foreground tabular-nums">{t("elements", { count: w.guids.length })}</span> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
