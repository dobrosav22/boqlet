"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { Param } from "@ifc-boq/types";
import type { LineDetail } from "@/api/hooks/sheet";
import { toReadable, type Lexicon } from "@/features/library/lib/readable";
import { cn } from "@/lib/utils";
import { displayUnit } from "./model";

type Step = NonNullable<LineDetail["trace"]["steps"]>[number];

/** Steps whose value is a contribution (shown signed); the others state an amount. */
const SIGNED = new Set<Step["kind"]>(["add", "deduct", "factor", "round", "edit"]);
/** Units a deduction's threshold is compared in, by `compareBy`. */
const COMPARE_UNIT: Record<string, string> = { area: "m2", width: "m", height: "m", volume: "m3" };

/**
 * "How it is calculated" (F06 §5, P25): the line's quantity in plain words, step by step, from the
 * engine's structured trace steps (EN-013; the mock's "Trace steps" fake in phase 1). Each step can
 * be expanded to its elements; each rule-set value links to its Settings question in the Library;
 * a derived line links to its source line; an edited line shows the engine's value, the edit, who
 * and why. The steps add up to the result.
 */
export function HowCalculated({
  line,
  slots,
  lex,
  libraryHref,
  modelNames,
  describe,
  onSelect,
}: {
  line: LineDetail;
  /** The run's rule-set slots (labels, units). */
  slots: Record<string, Param>;
  lex: Lexicon;
  /** The Library page of the run's rule set, where `?question=<slot>` opens a Settings question. */
  libraryHref: string | null;
  modelNames: Map<string, string>;
  /** Another line's description, by key (a derived line's sources). */
  describe: (key: string) => string | undefined;
  onSelect: (key: string) => void;
}) {
  const t = useTranslations("boqs.how");
  const steps = line.trace.steps ?? [];
  if (steps.length === 0)
    return (
      <p className="text-muted-foreground" data-testid="how-calculated-none">
        {t("noSteps")}
      </p>
    );
  return (
    <ol className="flex flex-col" data-testid="how-calculated">
      {steps.map((step, i) => (
        <StepRow key={i} step={step} line={line} slots={slots} lex={lex} libraryHref={libraryHref} modelNames={modelNames} describe={describe} onSelect={onSelect} />
      ))}
    </ol>
  );
}

function StepRow({
  step,
  line,
  slots,
  lex,
  libraryHref,
  modelNames,
  describe,
  onSelect,
}: {
  step: Step;
  line: LineDetail;
  slots: Record<string, Param>;
  lex: Lexicon;
  libraryHref: string | null;
  modelNames: Map<string, string>;
  describe: (key: string) => string | undefined;
  onSelect: (key: string) => void;
}) {
  const t = useTranslations("boqs.how");
  const tl = useTranslations("library");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const p = step.params as Record<string, unknown>;
  const unit = step.unit ?? line.unit;
  const amount = (v: number, digits = 3) => format.number(v, { maximumFractionDigits: digits });
  const withUnit = (v: unknown, u: string | undefined) => (typeof v === "number" ? `${amount(v, 6)}${u ? ` ${displayUnit(u)}` : ""}` : "—");
  const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
  const num = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : 0);
  const count = num("count");
  const things = t("what", { what: str("what") || "other", count, raw: str("what") });

  const values: Record<string, string | number> = {
    count,
    missing: num("missing"),
    kept: num("kept"),
    surface: str("surface") || "other",
    start: str("start") || "other",
    basis: str("basis") || "other",
    things,
    threshold: withUnit(p.threshold, COMPARE_UNIT[str("compareBy")]),
    factor: typeof p.factor === "number" ? amount(p.factor, 6) : "",
    minimum: withUnit(p.minimum, unit),
    quantity: withUnit(p.quantity, unit),
    engineQuantity: withUnit(p.engineQuantity, str("engineUnit") || unit),
    by: str("by"),
    hasBy: p.by ? "yes" : "no",
    hasFactor: typeof p.factor === "number" ? "yes" : "no",
    lines: num("lines"),
  };
  const key = `codes.${step.code.replaceAll(".", "_")}`;
  const source = str("sourceLine");
  const sourceLines = Array.isArray(p.sourceLines) ? (p.sourceLines as string[]) : [];
  const sentence = !t.has(key)
    ? step.code
    : step.kind === "derive"
      ? t.rich(key, {
          ...values,
          source: str("sourceDescription") || source,
          line: (chunks) =>
            source ? (
              <button className="text-link hover:underline" onClick={() => onSelect(source)} data-testid="how-source-line">
                {chunks}
              </button>
            ) : (
              chunks
            ),
        })
      : t(key, values);

  const value =
    step.value === null
      ? "—"
      : `${format.number(step.value, { maximumFractionDigits: step.kind === "round" ? 6 : 3, ...(SIGNED.has(step.kind) ? { signDisplay: "exceptZero" } : {}) })} ${displayUnit(unit)}`;
  const elements = step.elements?.length ? line.trace.elements.filter((e) => step.elements!.includes(e.guid)) : [];
  // Rule-set values this step used: its `param`, and a deduction's mode.
  const settings = [step.param, typeof p.modeParam === "string" ? p.modeParam : undefined].filter((s): s is string => !!s);
  const slotLabel = (name: string) => lex.slotLabels.get(name) ?? slots[name]?.label ?? (tl.has(`names.${name}.label`) ? tl(`names.${name}.label`) : name);
  const slotValue = (name: string) => {
    const v = (line.trace.params as Record<string, unknown>)[name] ?? slots[name]?.value;
    if (typeof v === "number") {
      const slot = slots[name];
      return withUnit(v, slot && "unit" in slot ? slot.unit : undefined);
    }
    if (typeof v === "boolean") return v ? t("yes") : t("no");
    if (typeof v === "string") {
      const slot = slots[name];
      if (slot?.type === "formula") return toReadable(v, lex);
      return (slot?.type === "choice" ? slot.optionLabels?.[v] : undefined) ?? v;
    }
    return "—";
  };

  return (
    <li
      className={cn("flex flex-col gap-1 border-b border-border py-2", step.kind === "result" && "border-b-0 border-t-2 border-t-foreground/40")}
      data-testid="how-step"
      data-kind={step.kind}
      data-value={step.value ?? ""}
    >
      <div className="flex items-baseline gap-3">
        <span className={cn("flex-1 text-prose", step.kind === "result" && "font-semibold")}>{sentence}</span>
        <span className={cn("shrink-0 text-right tabular-nums", step.kind === "result" && "font-semibold")} data-testid="how-step-value">
          {value}
        </span>
      </div>
      {step.kind === "derive" && typeof p.formula === "string" && !step.param && <p className="text-muted-foreground">{toReadable(p.formula, lex)}</p>}
      {step.kind === "derive" && sourceLines.length > 1 && (
        <ul className="flex flex-col gap-0.5 pl-5" data-testid="how-source-lines">
          {sourceLines.map((key) => (
            <li key={key}>
              <button className="text-left text-link hover:underline" onClick={() => onSelect(key)} data-testid="how-source-line">
                {describe(key) ?? key}
              </button>
            </li>
          ))}
        </ul>
      )}
      {step.kind === "start" && typeof p.formula === "string" && <p className="text-muted-foreground">{toReadable(p.formula.split("   ->   ")[0]!, lex)}</p>}
      {num("missing") > 0 && <p className="text-muted-foreground">{t("missingNote", { count: num("missing") })}</p>}
      {step.kind === "edit" && str("reason") && <p className="text-muted-foreground">{t("reason", { reason: str("reason") })}</p>}
      {settings.map((slot) =>
        libraryHref ? (
          <Link key={slot} href={`${libraryHref}?question=${encodeURIComponent(slot)}`} className="text-link hover:underline" data-testid="how-setting" data-slot={slot}>
            {t("yourAnswer", { name: slotLabel(slot), value: slotValue(slot) })}
          </Link>
        ) : (
          <span key={slot} className="text-muted-foreground" data-testid="how-setting" data-slot={slot}>
            {t("yourAnswer", { name: slotLabel(slot), value: slotValue(slot) })}
          </span>
        ),
      )}
      {elements.length > 0 && (
        <>
          <button
            className="flex items-center gap-1 self-start text-muted-foreground hover:text-foreground"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            data-testid="how-step-toggle"
          >
            {open ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
            {t("elements", { count: elements.length })}
          </button>
          {open && (
            <ul className="flex flex-col gap-0.5 pl-5" data-testid="how-step-elements">
              {elements.map((e, i) => (
                <li key={e.guid + i} className="flex gap-3">
                  <span className="min-w-0 flex-1 break-words" title={e.guid}>
                    {e.name || e.guid}
                    {e.model && modelNames.size > 1 ? <span className="text-muted-foreground"> · {modelNames.get(e.model) ?? e.model.slice(0, 8)}</span> : null}
                  </span>
                  {/* An element's share of the line; under a deduction it would read as the deducted amount. */}
                  {(step.kind === "start" || step.kind === "derive") && (
                    <span className="shrink-0 tabular-nums text-muted-foreground">{e.quantity === null ? "—" : amount(e.quantity)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  );
}
