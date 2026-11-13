"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { EditField, SheetLine } from "./edits";
import { displayUnit } from "./model";

export interface LineActions {
  restore: (line: SheetLine, field: EditField | "all") => void;
  exclude: (line: SheetLine) => void;
  include: (line: SheetLine) => void;
  markToConfirm: (line: SheetLine) => void;
  addBelow: (line: SheetLine) => void;
  editManual: (line: SheetLine) => void;
  removeManual: (line: SheetLine) => void;
}

/**
 * The line's edits in the detail panel (F06 §6): each edited field with the engine's value and a
 * Restore, the reason, and the line's actions (exclude, mark to confirm, add a line below; for a
 * manual line, edit and delete). Read-only users see the edits without the actions.
 */
export function LineEdits({ line, editable, systemNames, actions }: { line: SheetLine; editable: boolean; systemNames: Map<string, string>; actions: LineActions }) {
  const t = useTranslations("boqs.edits");
  const format = useFormatter();
  const edit = line.edit;
  const num = (v: number | null) => (v === null ? t("toConfirm") : format.number(v, { maximumFractionDigits: 6 }));
  const engineText = (field: EditField): string => {
    if (!edit) return "";
    const e = edit.engine;
    switch (field) {
      case "quantity":
        return `${num(e.quantity)} ${displayUnit(e.unit)}`;
      case "unit":
        return displayUnit(e.unit);
      case "description":
        return e.description;
      case "codes":
        return Object.keys(edit.override.codes ?? {})
          .map((s) => `${systemNames.get(s) ?? s}: ${e.codes[s] ?? t("noCode")}`)
          .join(", ");
      case "excluded":
        return t("included");
      case "order":
        return t("engineOrder");
    }
  };
  const editedText = (field: EditField): string => {
    switch (field) {
      case "quantity":
        return `${num(line.quantity)} ${displayUnit(line.unit)}`;
      case "unit":
        return displayUnit(line.unit);
      case "description":
        return line.description;
      case "codes":
        return Object.entries(edit?.override.codes ?? {})
          .map(([s, c]) => `${systemNames.get(s) ?? s}: ${c}`)
          .join(", ");
      case "excluded":
        return t("excludedValue");
      case "order":
        return t("movedValue");
    }
  };
  // The unit is restored with its quantity.
  const shown = (edit?.fields ?? []).filter((f) => !(f === "unit" && edit?.fields.includes("quantity")));

  return (
    <section className="flex flex-col gap-3 border-y border-border py-3" data-testid="line-edits">
      {line.pending && <p className="text-muted-foreground">{t("pendingManual")}</p>}
      {edit && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="label-caps text-muted-foreground">{t("title")}</h4>
            {editable && (
              <Button variant="ghost" onClick={() => actions.restore(line, "all")} data-testid="restore-all">
                {t("restoreAll")}
              </Button>
            )}
          </div>
          <ul className="flex flex-col gap-1.5">
            {shown.map((field) => (
              <li key={field} className="flex items-baseline gap-2" data-testid={`edit-${field}`}>
                <span className="w-24 shrink-0 text-muted-foreground">{t(`fields.${field}`)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{editedText(field)}</span>
                  <span className="text-muted-foreground"> · {t("engineWas", { value: engineText(field) })}</span>
                </span>
                {editable && (
                  <Button variant="ghost" onClick={() => actions.restore(line, field)} data-testid={`restore-${field}`}>
                    {t("restore")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {edit.override.reason && <p className="text-muted-foreground">{t("reasonWas", { reason: edit.override.reason })}</p>}
        </div>
      )}
      {editable && (
        <div className="flex flex-wrap gap-2">
          {line.excluded ? (
            <Button variant="outline" onClick={() => actions.include(line)} data-testid="include-line">
              {t("include")}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => actions.exclude(line)} data-testid="exclude-line">
              {t("exclude")}
            </Button>
          )}
          {line.quantity !== null && !line.pending && (
            <Button variant="outline" onClick={() => actions.markToConfirm(line)} data-testid="mark-to-confirm">
              {t("markToConfirm")}
            </Button>
          )}
          <Button variant="outline" onClick={() => actions.addBelow(line)} data-testid="add-below">
            {t("addBelow")}
          </Button>
          {line.manual && (
            <>
              <Button variant="outline" onClick={() => actions.editManual(line)} data-testid="edit-manual">
                {t("editManual")}
              </Button>
              <Button variant="ghost" onClick={() => actions.removeManual(line)} data-testid="remove-manual">
                {t("removeManual")}
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
