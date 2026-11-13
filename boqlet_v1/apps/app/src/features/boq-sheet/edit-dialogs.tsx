"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { checkRuleSetPatch, type ManualItemInput, type ManualItemRecord } from "@/api/hooks/edits";
import type { Run } from "@/api/hooks/boqs";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SearchPicker } from "@/features/questions/search-picker";
import type { CodeLists } from "./edits";
import { displayUnit } from "./model";

/** A reason for a quantity change or an exclusion (F06 §6: required for both). */
export function ReasonDialog({ title, summary, initial, onConfirm, onClose }: { title: string; summary: string; initial?: string; onConfirm: (reason: string) => void; onClose: () => void }) {
  const t = useTranslations("boqs.edits");
  const [reason, setReason] = useState(initial ?? "");
  const ok = reason.trim().length > 0;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="reason-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) onConfirm(reason.trim());
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="label-caps text-muted-foreground">{t("reason")}</span>
            <Input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonHint")} data-testid="reason-input" />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!ok} data-testid="reason-confirm">
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const UNITS = ["nr", "item", "sum", "m", "m2", "m3", "kg", "t", "h", "mm", "km", "ft", "ft2", "ft3", "yd2", "yd3", "lb"];
const KINDS = ["other", "preliminary", "provisional_sum", "lump_sum", "daywork"] as const;

/** The manual line's quantity as a formula is checked by the engine through a slot it points to (expr.py syntax check). */
function checkDoc(item: Record<string, unknown>, formula: string) {
  return {
    schemaVersion: "1.0",
    id: "manual-line-check",
    name: "Manual line check",
    version: "1",
    extends: "",
    params: { manual_formula: { type: "formula", label: "Formula", value: formula, unit: item.unit } },
    manual: [{ ...item, formula: { param: "manual_formula" } }],
  };
}

const newId = () => `manual-${Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("")}`;

/**
 * F06 §7: a manual line: description, unit, a quantity or a formula over `building.*` (checked by
 * the engine before saving), a code per classification (prefilled with the group clicked) and
 * where it goes (after a line). Applied on the next run like any line.
 */
export function ManualLineDialog({
  run,
  systems,
  lists,
  record,
  defaults,
  saving,
  error,
  onSave,
  onClose,
}: {
  run: Run;
  systems: { id: string; name: string }[];
  lists: CodeLists;
  record?: ManualItemRecord;
  defaults?: { codes?: Record<string, string>; sortHint?: string };
  saving: boolean;
  error: unknown;
  onSave: (input: ManualItemInput) => void;
  onClose: () => void;
}) {
  const t = useTranslations("boqs.manual");
  const message = useErrorMessage();
  const item = record?.item;
  const [description, setDescription] = useState(typeof item?.description === "string" ? item.description : "");
  const [unit, setUnit] = useState(item?.unit ?? "item");
  const [kind, setKind] = useState<(typeof KINDS)[number]>((item?.kind as (typeof KINDS)[number]) ?? "other");
  const [mode, setMode] = useState<"quantity" | "formula">(typeof item?.formula === "string" ? "formula" : "quantity");
  const [quantity, setQuantity] = useState(typeof item?.quantity === "number" ? String(item.quantity) : "");
  const [formula, setFormula] = useState(typeof item?.formula === "string" ? item.formula : "");
  const [codes, setCodes] = useState<Record<string, string>>(record?.codes ?? defaults?.codes ?? {});
  const [problems, setProblems] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<unknown>(null);

  const parsed = quantity.trim() === "" ? null : Number(quantity.replace(",", "."));
  const quantityOk = parsed === null || (Number.isFinite(parsed) && parsed >= 0);
  const valid = description.trim() !== "" && (mode === "formula" ? formula.trim() !== "" : quantityOk);

  async function save() {
    const sortHint = record?.sortHint ?? defaults?.sortHint;
    const base = { id: item?.id ?? newId(), kind, description: description.trim(), unit } as Record<string, unknown>;
    const next = mode === "formula" ? { ...base, formula: formula.trim() } : parsed === null ? base : { ...base, quantity: parsed };
    const input: ManualItemInput = {
      item: next as ManualItemInput["item"],
      ...(Object.keys(codes).length ? { codes } : {}),
      ...(sortHint ? { sortHint } : {}),
    };
    if (mode === "formula") {
      setChecking(true);
      setCheckError(null);
      try {
        const result = await checkRuleSetPatch(checkDoc(base, formula.trim()), run.snapshotVersions?.ruleSetVersionId ?? "");
        setProblems(result.problems);
        if (!result.ok) return;
      } catch (e) {
        setCheckError(e);
        return;
      } finally {
        setChecking(false);
      }
    }
    onSave(input);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="manual-line-dialog">
        <DialogHeader>
          <DialogTitle>{record ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{t("intro")}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) void save();
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="label-caps text-muted-foreground">{t("description")}</span>
            <Input autoFocus value={description} onChange={(e) => setDescription(e.target.value)} data-testid="manual-description" />
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1">
              <span className="label-caps text-muted-foreground">{t("unit")}</span>
              <NativeSelect value={unit} onChange={(e) => setUnit(e.target.value)} data-testid="manual-unit">
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {displayUnit(u)}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="flex flex-col gap-1">
              <span className="label-caps text-muted-foreground">{t("kind")}</span>
              <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])} data-testid="manual-kind">
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`kinds.${k}`)}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="label-caps mb-1 text-muted-foreground">{t("quantity")}</legend>
            <div className="flex gap-4">
              {(["quantity", "formula"] as const).map((m) => (
                <label key={m} className="flex items-center gap-1.5">
                  <input type="radio" name="manual-mode" checked={mode === m} onChange={() => setMode(m)} className="accent-[var(--link)]" />
                  {t(`modes.${m}`)}
                </label>
              ))}
            </div>
            {mode === "quantity" ? (
              <div className="flex items-center gap-2">
                <Input inputMode="decimal" className="w-36 text-right tabular-nums" value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-label={t("quantity")} data-testid="manual-quantity" />
                <span className="text-muted-foreground">{displayUnit(unit)}</span>
                <span className="text-muted-foreground">{t("emptyIsFlagged")}</span>
              </div>
            ) : (
              <>
                <Input value={formula} onChange={(e) => setFormula(e.target.value)} placeholder={t("formulaPlaceholder")} aria-label={t("formula")} className="font-mono" data-testid="manual-formula" />
                <p className="text-muted-foreground">{t("formulaHelp")}</p>
              </>
            )}
          </fieldset>
          {systems.map((s) => {
            const list = lists.get(s.id);
            const items = list ? [...list.values()].map((c) => ({ value: c.code, label: c.code, hint: c.title })) : [];
            return (
              <label key={s.id} className="flex flex-col gap-1">
                <span className="label-caps text-muted-foreground">{s.name}</span>
                <SearchPicker
                  items={items}
                  value={codes[s.id]}
                  onPick={(code) => setCodes((c) => ({ ...c, [s.id]: code }))}
                  label={s.name}
                  placeholder={t("pickCode")}
                  empty={t("noCode")}
                  data-testid={`manual-code-${s.id}`}
                />
              </label>
            );
          })}
          {problems.length > 0 && (
            <ul role="alert" className="flex flex-col gap-1 text-error" data-testid="manual-problems">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {(error || checkError) ? (
            <p role="alert" className="text-error">
              {message(error ?? checkError)}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!valid || saving || checking} data-testid="manual-save">
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
