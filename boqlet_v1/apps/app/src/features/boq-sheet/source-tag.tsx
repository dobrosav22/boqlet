"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * A line's source as the design guidelines show it: measured plain, derived with a blue outline,
 * manual on yellow, "to confirm" on orange. Always a word, never colour alone.
 */
export function SourceTag({ source, className }: { source: string; className?: string }) {
  const t = useTranslations("boqs.sheet.sources");
  if (source === "measured") return <span className={cn("text-muted-foreground", className)}>{t("measured")}</span>;
  const style =
    source === "derived"
      ? "border-[var(--status-derived)] text-link"
      : source === "manual"
        ? "border-transparent bg-[var(--status-manual)] text-[#151515]"
        : source === "flagged"
          ? "border-transparent bg-[var(--status-attention)] text-[#151515]"
          : "border-border";
  return <span className={cn("label-caps rounded-[var(--radius)] border px-1", style, className)}>{t.has(source) ? t(source) : source}</span>;
}
