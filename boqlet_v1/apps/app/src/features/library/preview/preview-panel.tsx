"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { usePreview, type Preset, type PreviewResult } from "@/api/hooks/library";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ModelVersionPicker, type PickedModelVersion } from "./model-version-picker";

type Line = PreviewResult["lines"][number];
type Change = PreviewResult["changes"][number];

const PICK_KEY = "boqlet-preview-model";

/**
 * The preview beside the editor (F10 §6, EN-005 fake): the draft's BoQ lines on a chosen model
 * version, and what changed against the published version. It runs again after each save of the
 * draft when "Follow my changes" is on. No run is stored; previews count as processing (BR-62).
 */
export function PreviewPanel({ preset, saves }: { preset: Preset; saves: number }) {
  const t = useTranslations("library.preview");
  const message = useErrorMessage();
  const format = useFormatter();
  const [picked, setPicked] = useState<PickedModelVersion | null>(() => {
    try {
      const raw = window.localStorage.getItem(PICK_KEY);
      const v = raw ? (JSON.parse(raw) as PickedModelVersion) : null;
      return v && (!preset.projectId || v.projectId === preset.projectId) ? v : null;
    } catch {
      return null;
    }
  });
  const [follow, setFollow] = useState(true);
  const [onlyChanged, setOnlyChanged] = useState(false);
  const preview = usePreview(preset.id);
  const run = (v: PickedModelVersion | null = picked) => v && preview.mutate({ modelVersionIds: [v.versionId] });

  // Re-run after each save while following (one at a time: a save during a run waits for the next).
  const lastSaves = useRef(saves);
  useEffect(() => {
    if (saves === lastSaves.current) return;
    lastSaves.current = saves;
    if (follow && picked && !preview.isPending) preview.mutate({ modelVersionIds: [picked.versionId] });
  }, [saves, follow, picked, preview]);

  const choose = (v: PickedModelVersion | null) => {
    setPicked(v);
    try {
      if (v) window.localStorage.setItem(PICK_KEY, JSON.stringify(v));
    } catch {
      /* storage blocked */
    }
    if (v) run(v);
  };

  const data = preview.data?.result;
  const changes = new Map((data?.changes ?? []).map((c) => [c.key, c]));
  const removed = (data?.changes ?? []).filter((c) => c.change === "removed");
  const rows: { line: Line; change?: Change }[] = [
    ...(data?.lines ?? []).map((line) => ({ line, change: changes.get(line.key) })),
    ...removed.map((c) => ({ line: c.before!, change: c })),
  ].filter((r) => !onlyChanged || r.change);
  const qty = (q: number | null) => (q === null ? t("toConfirm") : format.number(q, { maximumFractionDigits: 3 }));

  return (
    <aside className="flex min-w-0 flex-col gap-3 rounded-[var(--radius)] border border-border p-3" data-testid="preview-panel" data-state={preview.isPending ? "running" : data ? "done" : "idle"}>
      <div className="flex items-center gap-2">
        <h2 className="label-caps flex-1">{t("title")}</h2>
        <Button variant="outline" size="sm" disabled={!picked || preview.isPending} onClick={() => run()} data-testid="preview-run">
          {preview.isPending ? t("running") : t("run")}
        </Button>
      </div>
      <ModelVersionPicker projectId={preset.projectId} value={picked} onChange={choose} />
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} data-testid="preview-follow" />
        {t("follow")}
      </label>
      {preview.isError && (
        <p role="alert" className="text-error">
          {message(preview.error)}
        </p>
      )}
      {!picked && <p className="text-muted-foreground">{t("hint")}</p>}
      {data && (
        <>
          <p data-testid="preview-summary">
            {t("summary", { lines: data.lines.length, questions: data.questions })}{" "}
            {data.compare
              ? t("changed", { added: data.compare.added, removed: data.compare.removed, changed: data.compare.changed, n: data.compare.versionNumber })
              : t("noCompare")}
          </p>
          {data.changes.length > 0 && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} data-testid="preview-only-changed" />
              {t("onlyChanged")}
            </label>
          )}
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full border-collapse text-ui" data-testid="preview-lines">
              <thead>
                <tr className="label-caps text-muted-foreground">
                  <th className="py-1 text-left font-medium">{t("description")}</th>
                  <th className="py-1 text-right font-medium">{t("quantity")}</th>
                  <th className="py-1 pl-2 text-left font-medium">{t("unit")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ line, change }) => (
                  <tr
                    key={`${change?.change ?? "same"}:${line.key}`}
                    data-testid="preview-line"
                    data-key={line.key}
                    data-change={change?.change ?? "same"}
                    className={cn("border-t border-border align-top", change?.change === "removed" && "text-muted-foreground line-through", change && change.change !== "removed" && "bg-selection")}
                  >
                    <td className="py-1 pr-2">
                      {line.description}
                      {change?.change === "added" && <span className="label-caps ml-2 text-link">{t("added")}</span>}
                    </td>
                    <td className="py-1 text-right tabular-nums whitespace-nowrap">
                      {change?.change === "changed" && change.before && change.before.quantity !== line.quantity && <span className="text-muted-foreground">{qty(change.before.quantity)} → </span>}
                      {qty(line.quantity)}
                    </td>
                    <td className="py-1 pl-2">{line.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </aside>
  );
}
