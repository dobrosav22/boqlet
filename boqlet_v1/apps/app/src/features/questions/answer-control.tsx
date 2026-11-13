"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Answer, AnswerType, Term } from "@/api/hooks/decisions";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchTerms, termPath } from "./model";
import { SearchPicker, type PickItem } from "./search-picker";

/** What the pickers choose from; a list that isn't known falls back to typing the id. */
export interface AnswerContext {
  terms: readonly Term[];
  /** The run's rule-set items (for `unmatched`). */
  rules?: readonly { id: string; label: string }[];
  /** Codes by system (for `unclassified`, `classification_conflict`). */
  codes?: ReadonlyMap<string, readonly { code: string; title: string }[]>;
}

/**
 * One answer control per `AnswerType` (F05 table): a term picker, a number with its unit or "flag
 * the line", a rule picker or "exclude", a code picker, a choice with the recommended option
 * marked. `onChange(value, commit)`: `commit` is true when the person finished choosing (a pick,
 * an option, Enter or "Use" on a number), so a row can save at once and a bulk bar can wait.
 */
export function AnswerControl({
  type,
  value,
  onChange,
  context,
  disabled,
  label,
  testId,
}: {
  type: AnswerType;
  value: Answer | undefined;
  onChange: (value: Answer, commit: boolean) => void;
  context: AnswerContext;
  disabled?: boolean;
  /** Accessible name: what is being answered. */
  label: string;
  testId?: string;
}) {
  const t = useTranslations("questions.answer");
  switch (type.kind) {
    case "term":
      return <TermPicker category={type.category} terms={context.terms} value={typeof value === "string" ? value : undefined} onPick={(v) => onChange(v, true)} disabled={disabled} label={label} testId={testId} />;
    case "number":
      return <NumberAnswer unit={type.unit} value={value} onChange={onChange} disabled={disabled} label={label} testId={testId} />;
    case "choice":
      return <ChoiceAnswer options={type.options} value={typeof value === "string" ? value : undefined} onPick={(v) => onChange(v, true)} disabled={disabled} label={label} testId={testId} />;
    case "rule": {
      const items: PickItem[] = [{ value: "exclude", label: t("exclude") }, ...(context.rules ?? []).map((r) => ({ value: r.id, label: r.label, hint: r.id }))];
      return <ListAnswer items={items} known={!!context.rules} value={value} onChange={onChange} disabled={disabled} label={label} placeholder={t("pickRule")} testId={testId} />;
    }
    case "code": {
      const codes = context.codes?.get(type.system);
      const items: PickItem[] = (codes ?? []).map((c) => ({ value: c.code, label: c.code, hint: c.title }));
      return <ListAnswer items={items} known={!!codes} value={value} onChange={onChange} disabled={disabled} label={label} placeholder={t("pickCode")} testId={testId} />;
    }
  }
}

function TermPicker({ category, terms, value, onPick, disabled, label, testId }: { category?: string; terms: readonly Term[]; value: string | undefined; onPick: (v: string) => void; disabled?: boolean; label: string; testId?: string }) {
  const t = useTranslations("questions.answer");
  const byId = useMemo(() => new Map(terms.map((x) => [x.id, x])), [terms]);
  const toItem = (term: Term): PickItem => {
    const path = termPath(term.id, byId);
    return { value: term.id, label: term.label, ...(path.length > 1 ? { hint: path.slice(0, -1).join(" › ") } : {}) };
  };
  const inCategory = useMemo(() => terms.filter((x) => !category || x.category === category), [terms, category]);
  const items = useMemo(() => {
    const list = inCategory.map(toItem);
    // A decision whose term no longer exists still shows its id.
    if (value && !byId.has(value)) list.unshift({ value, label: value });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inCategory, value, byId]);
  return (
    <SearchPicker
      items={items}
      value={value}
      onPick={onPick}
      search={(q) => searchTerms(inCategory, q, undefined, 50).map(toItem)}
      label={label}
      placeholder={t("pickTerm")}
      empty={t("noTerms")}
      disabled={disabled}
      data-testid={testId}
    />
  );
}

function NumberAnswer({ unit, value, onChange, disabled, label, testId }: { unit?: string; value: Answer | undefined; onChange: (v: Answer, commit: boolean) => void; disabled?: boolean; label: string; testId?: string }) {
  const t = useTranslations("questions.answer");
  const units = useTranslations("units");
  const [text, setText] = useState(typeof value === "number" ? String(value) : "");
  const parsed = text.trim() === "" ? NaN : Number(text.replace(",", "."));
  const valid = Number.isFinite(parsed) && parsed >= 0;
  const unitLabel = unit ? (units.has(unit) ? units(unit) : unit) : "";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Input
          inputMode="decimal"
          aria-label={label}
          className="w-28 text-right tabular-nums"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid) onChange(parsed, true);
          }}
          data-testid={testId}
        />
        {unitLabel && <span className="text-muted-foreground">{unitLabel}</span>}
        <Button variant="outline" disabled={disabled || !valid} onClick={() => onChange(parsed, true)}>
          {t("use")}
        </Button>
      </div>
      <Button variant={value === "flag" ? "default" : "ghost"} disabled={disabled} onClick={() => onChange("flag", true)} aria-pressed={value === "flag"}>
        {t("flag")}
      </Button>
    </div>
  );
}

function ChoiceAnswer({ options, value, onPick, disabled, label, testId }: { options: { value: string; label: string; recommended?: boolean }[]; value: string | undefined; onPick: (v: string) => void; disabled?: boolean; label: string; testId?: string }) {
  const t = useTranslations("questions.answer");
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-x-4 gap-y-1" data-testid={testId}>
      {options.map((o) => (
        <label key={o.value} className={cn("flex items-center gap-1.5", disabled ? "opacity-60" : "cursor-pointer")}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} disabled={disabled} onChange={() => onPick(o.value)} className="accent-[var(--link)]" />
          <span>{o.label}</span>
          {o.recommended && <span className="label-caps text-muted-foreground">{t("recommended")}</span>}
        </label>
      ))}
    </div>
  );
}

/** A picker over a known list, or a plain text field when the list isn't available (e.g. outside a run). */
function ListAnswer({ items, known, value, onChange, disabled, label, placeholder, testId }: { items: PickItem[]; known: boolean; value: Answer | undefined; onChange: (v: Answer, commit: boolean) => void; disabled?: boolean; label: string; placeholder: string; testId?: string }) {
  const t = useTranslations("questions.answer");
  const [text, setText] = useState(typeof value === "string" ? value : "");
  if (known && items.length <= 12) {
    return (
      <NativeSelect aria-label={label} value={typeof value === "string" ? value : ""} disabled={disabled} onChange={(e) => e.target.value && onChange(e.target.value, true)} data-testid={testId}>
        <option value="">{placeholder}</option>
        {items.map((i) => (
          <option key={i.value} value={i.value}>
            {i.hint && i.hint !== i.value ? `${i.label} — ${i.hint}` : i.label}
          </option>
        ))}
      </NativeSelect>
    );
  }
  if (known) return <SearchPicker items={items} value={typeof value === "string" ? value : undefined} onPick={(v) => onChange(v, true)} label={label} placeholder={placeholder} empty={t("nothingFound")} disabled={disabled} data-testid={testId} />;
  return (
    <div className="flex items-center gap-1">
      <Input aria-label={label} className="w-48" value={text} disabled={disabled} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && text.trim() && onChange(text.trim(), true)} data-testid={testId} />
      <Button variant="outline" disabled={disabled || !text.trim()} onClick={() => onChange(text.trim(), true)}>
        {t("use")}
      </Button>
    </div>
  );
}
