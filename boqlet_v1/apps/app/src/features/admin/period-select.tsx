"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Period } from "@/api/hooks/admin";
import { NativeSelect } from "@/components/native-select";
import { Input } from "@/components/ui/input";

const PRESETS = ["7", "30", "90", "custom"] as const;
type Preset = (typeof PRESETS)[number];

const day = (d: Date) => d.toISOString().slice(0, 10);

/** F19 §1: 7 / 30 / 90 days or a custom range, as `from`/`to` dates (UTC days, both included). */
export function usePeriod() {
  const [preset, setPreset] = useState<Preset>("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const period: Period = useMemo(() => {
    if (preset === "custom") return from && to ? { from, to } : {};
    const end = new Date();
    return { from: day(new Date(end.getTime() - (Number(preset) - 1) * 86_400_000)), to: day(end) };
  }, [preset, from, to]);
  return { preset, setPreset, from, setFrom, to, setTo, period };
}

export function PeriodSelect({ state }: { state: ReturnType<typeof usePeriod> }) {
  const t = useTranslations("admin.period");
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="label-caps text-muted-foreground">{t("label")}</span>
        <NativeSelect value={state.preset} onChange={(e) => state.setPreset(e.target.value as Preset)} data-testid="admin-period">
          {PRESETS.map((p) => (
            <option key={p} value={p}>
              {t(p)}
            </option>
          ))}
        </NativeSelect>
      </label>
      {state.preset === "custom" && (
        <>
          <label className="flex flex-col gap-1">
            <span className="label-caps text-muted-foreground">{t("from")}</span>
            <Input type="date" value={state.from} onChange={(e) => state.setFrom(e.target.value)} data-testid="admin-period-from" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label-caps text-muted-foreground">{t("to")}</span>
            <Input type="date" value={state.to} onChange={(e) => state.setTo(e.target.value)} data-testid="admin-period-to" />
          </label>
        </>
      )}
    </div>
  );
}
