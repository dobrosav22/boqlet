"use client";

/**
 * BoQ items in plain words, ported from the PoC's `itemStory.tsx`: one sentence per item ("Measure
 * the area (both faces) of walls where material is a kind of concrete, minus openings larger than
 * 0.5 m2, one line per type name, written as …"). Each part of the sentence is a button that jumps
 * to where it is edited. Sentences come from `ruleSetEditor.story` with ICU parameters (F15).
 *
 * Words only: formulas are shown in their readable form and never evaluated here.
 */
import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { DeductionRule, DerivedRule, ItemRule, ManualItem, Param, QuantitySpec, Selector, Value } from "@ifc-boq/types";
import { cn } from "@/lib/utils";
import { sameFormula, type Lexicon } from "../lib/readable";
import { isRef, useFmtParam } from "../shared/fields";
import { decomposeMatch, listOf, useStoryWords, type StoryWords } from "../shared/story";
import { useVocab, type Vocab, type VocabGroup } from "../shared/use-vocab";
import { answersUsed, type Slots } from "./model";

/** Where a part of the sentence is edited. */
export type Part = "name" | "what" | "how" | "lines" | "text" | "more";

export type Translate = (key: string, values?: Record<string, string | number>) => string;

export interface StoryDeps {
  /** `ruleSetEditor.story` */
  t: Translate;
  vocab: Vocab;
  words: StoryWords;
  fmt: (p: Param | undefined) => string;
}

const COMPARE_UNIT: Record<string, string> = { area: "m2", width: "m", height: "m", length: "m", volume: "m3" };
const IF_FIELD = /^IF\((.+),\s*([A-Za-z_][\w.]*)\s*,\s*""\s*\)$/;
const GLUED = /^IF\((.+),\s*"([^"]*)"\s*\+\s*([A-Za-z_][\w.]*)\s*,\s*""\s*\)$/;

/**
 * The words of the item sentences, as plain functions over the rule set's slots (testable without
 * rendering). `useStoryText()` gives them in the user's language.
 */
export function makeStoryText({ t, vocab, words, fmt }: StoryDeps) {
  const { joinAnd, joinOr, fieldWords, prose } = words;

  const slotName = (name: string, slots: Slots) => t("slotName", { label: slots[name]?.label || name });

  /** A value in words; one taken from Settings reads as its current answer (the sentence lists those answers below). */
  const valueWords = <T,>(v: Value<T> | undefined, group: VocabGroup | null, slots: Slots): string | undefined => {
    if (v === undefined) return undefined;
    if (isRef(v)) {
      const p = slots[v.param];
      if (!p) return "?";
      return group && typeof p.value === "string" ? vocab.words(group, p.value) : fmt(p);
    }
    return group ? vocab.words(group, String(v)) : String(v).replace(/_/g, " ");
  };

  /** A formula answer: the ready-made formula's name and the formula, e.g. "Both faces: 2 × Net area". */
  const formulaAnswer = (name: string, slots: Slots, lex: Lexicon): string => {
    const p = slots[name];
    if (!p || p.type !== "formula") return t("notDefined", { slot: slotName(name, slots) });
    const f = prose(p.value, lex) || t("emptyFormula");
    return p.choices?.some((c) => sameFormula(c.value, p.value)) ? t("formulaAnswer", { label: fmt(p), formula: f }) : f;
  };

  /** One condition in words. */
  const condWords = (s: Selector, slots: Slots, lex: Lexicon): string => {
    if ("all" in s) return joinAnd(s.all.map((x) => condWords(x, slots, lex)));
    if ("any" in s) return t("either", { list: joinOr(s.any.map((x) => condWords(x, slots, lex))) });
    if ("not" in s) return t("not", { cond: condWords(s.not, slots, lex) });
    if ("ifcClass" in s) return t("theyAre", { classes: joinAnd(listOf(s.ifcClass).map((c) => vocab.classWords(String(c)))) });
    if ("family" in s) return t("theyAreFamily", { families: joinOr(listOf(s.family).map(String)) });
    if ("expr" in s) return prose(s.expr, lex) || t("emptyFormulaParen");
    const lit = listOf(s.value).map((x) => (x === true ? t("yes") : x === false ? t("no") : String(x)));
    const v = isRef(s.value) ? fmt(slots[s.value.param]) : s.op === "between" ? joinAnd(lit) : joinOr(lit);
    const field = fieldWords(s.field);
    const op = vocab.words("ops", s.op);
    return v ? t("fieldCond", { field, op, value: v }) : t("fieldCondBare", { field, op });
  };

  /** "walls and slabs" (or "elements" when no kind is named). */
  const whatShort = (s: Selector): string => {
    const { classes } = decomposeMatch(s);
    return classes.length ? joinAnd(classes.map(vocab.classWords)) : t("elements");
  };

  const deductionWords = (d: DeductionRule, slots: Slots, lex: Lexicon): string | null => {
    const what = vocab.words("deductWhat", d.what);
    const mode = isRef(d.mode) ? (slots[d.mode.param]?.value as string | undefined) : d.mode;
    if (mode === "none" && !isRef(d.mode)) return null;
    const by = isRef(d.compareBy) ? (slots[d.compareBy.param]?.value as string | undefined) : (d.compareBy ?? "area");
    const amount = d.threshold === undefined ? undefined : isRef(d.threshold) ? slots[d.threshold.param]?.value : d.threshold;
    const size = amount === undefined ? "?" : t("size", { value: String(amount), unit: COMPARE_UNIT[by ?? ""] ?? "" }).trim();
    const sized = by && by !== "area" ? t("sizeBy", { size, by }) : size;
    let text =
      mode === "all" ? t("dedAll", { what })
      : mode === "over_threshold" ? t("dedOver", { what, size: sized })
      : mode === "excess_only" ? t("dedExcess", { what, size: sized })
      : mode === "per_element_sum" ? t("dedSum", { what, size })
      : mode === "none" ? t("dedNone", { what })
      : t("dedOther", { what, mode: mode ? vocab.words("deductModes", mode) : "?" });
    if (d.where) text = t("dedWhere", { text, where: prose(d.where, lex) });
    if (d.addReveals === true || isRef(d.addReveals)) text = t("dedReveals", { text });
    return text;
  };

  /** "area (both faces)", "volume", "length (along the axis)": a way of measuring without its verb. */
  const qtyShort = (q: QuantitySpec, slots: Slots, lex: Lexicon): string => {
    const base = (kind: string, ...details: (string | undefined)[]) => {
      const list = details.filter((x): x is string => !!x);
      let out = t(`kind.${kind}`);
      if (list.length) out = t("qtyWith", { what: out, details: list.join(t("comma")) });
      if ("unit" in q && q.unit) out = t("qtyIn", { what: out, unit: q.unit });
      return out;
    };
    switch (q.kind) {
      case "count":
      case "perimeter":
        return base(q.kind);
      case "length":
        return base("length", valueWords(q.basis, "lengthBases", slots));
      case "area":
        return base("area", valueWords(q.surface, "surfaces", slots), valueWords(q.start, "start", slots));
      case "volume":
        return base("volume", valueWords(q.start, "start", slots));
      case "mass":
        return base("mass", valueWords(q.basis, "massBases", slots));
      case "formula":
        return t("qtyFormula", { formula: isRef(q.expr) ? formulaAnswer(q.expr.param, slots, lex) : prose(q.expr, lex) || t("emptyFormula"), unit: q.unit });
      case "when":
        return t("qtyWhen", { cond: prose(q.if, lex) || "…", then: qtyShort(q.then, slots, lex), otherwise: qtyShort(q.else, slots, lex) });
      case "choose": {
        const now = isRef(q.pick) ? (slots[q.pick.param]?.value as string | undefined) : q.pick;
        const chosen = now !== undefined ? q.options[now] : undefined;
        const from = isRef(q.pick) ? t("fromSettings", { slot: slotName(q.pick.param, slots) }) : t("fixedChoice");
        return t("qtyChoose", { from, now: chosen ? qtyShort(chosen, slots, lex) : t("noWay", { name: now ?? "?" }) });
      }
    }
  };

  const condProse = (c: string, slots: Slots, lex: Lexicon) => {
    const m = /^p\.([A-Za-z_]\w*)$/.exec(c.trim());
    return m && slots[m[1]!]?.type === "boolean" ? t("slotIsYes", { slot: slotName(m[1]!, slots) }) : prose(c, lex);
  };

  /** One "split lines by" entry in words: a field, or "storey, when “Lines per storey” is yes". */
  const lineKeyWords = (k: string, slots: Slots, lex: Lexicon): string => {
    if (/^[A-Za-z_][\w]*$/.test(k) || k.startsWith("props.")) return fieldWords(k);
    const m = IF_FIELD.exec(k.trim());
    if (m) return t("lineWhen", { field: fieldWords(m[2]!), cond: condProse(m[1]!, slots, lex) });
    return prose(k, lex);
  };

  /** A line text template as pieces: plain text, and placeholders in words. */
  const templatePieces = (text: string, slots: Slots, lex: Lexicon): { text: string; value?: boolean }[] => {
    const out: { text: string; value?: boolean }[] = [];
    const re = /\{(expr:)?([^{}]*)\}/g;
    let last = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      if (m.index > last) out.push({ text: text.slice(last, m.index) });
      const inner = m[2]!.trim();
      const glued = GLUED.exec(inner);
      const mm = /\*\s*1000$/.test(inner);
      out.push({
        value: true,
        text: glued
          ? t("gluedWhen", { prefix: glued[2]!, field: fieldWords(glued[3]!), cond: condProse(glued[1]!, slots, lex) })
          : mm
            ? t("inMm", { text: prose(inner.replace(/\*\s*1000$/, ""), lex) })
            : prose(inner, lex),
      });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ text: text.slice(last) });
    return out;
  };

  /** What "More options" changes, in a few words; also its summary line. */
  const itemExtras = (item: ItemRule, slots: Slots): string[] => {
    const out: string[] = [];
    if (item.scope === "out") out.push(t("extraOut"));
    if (item.parts === "include") out.push(t("extraParts"));
    if (item.breakdown !== undefined) out.push(t("extraBreakdown", { what: valueWords(item.breakdown, "breakdowns", slots) ?? "?" }));
    if (item.partFilter) out.push(t("extraPartFilter"));
    if (item.bands?.length) out.push(t("extraBands", { fields: item.bands.map((b) => fieldWords(b.field)).join(t("comma")) }));
    if (item.factor !== undefined) out.push(t("extraFactor", { factor: String(isRef(item.factor) ? (slots[item.factor.param]?.value ?? "?") : item.factor) }));
    if (item.minimum) out.push(t("extraMinimum"));
    if (item.rounding) out.push(t("extraRounding"));
    if (item.onMissing !== undefined) out.push(t("extraMissing", { mode: t(`missing.${typeof item.onMissing === "string" ? item.onMissing : "default"}`) }));
    return out;
  };

  return { slotName, valueWords, formulaAnswer, condWords, whatShort, deductionWords, qtyShort, lineKeyWords, templatePieces, itemExtras, fieldWords, joinAnd, joinOr, prose };
}

export type StoryText = ReturnType<typeof makeStoryText>;

/** The sentence builders in the user's language. */
export function useStoryText(): StoryText {
  const t = useTranslations("ruleSetEditor.story");
  const vocab = useVocab();
  const words = useStoryWords();
  const fmt = useFmtParam();
  // fmt is rebuilt on every render; its output only depends on `library.fields`, like t's
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => makeStoryText({ t, vocab, words, fmt }), [t, vocab, words]);
}

/** The lexicon for readable formulas over these slots. */
export function useLexicon(slots: Slots): Lexicon {
  const vocab = useVocab();
  return useMemo(() => vocab.lexicon(slots), [vocab, slots]);
}

/* ---------------------------------------------------------------- pieces */

export function TemplateWords({ value, slots }: { value: Value<string>; slots: Slots }) {
  const t = useTranslations("ruleSetEditor.story");
  const story = useStoryText();
  const lex = useLexicon(slots);
  if (isRef(value)) return <>{t("fromSettingsText", { slot: story.slotName(value.param, slots) })}</>;
  if (!value) return <span className="text-muted-foreground">{t("noText")}</span>;
  return (
    <span>
      {t.rich("quoted", {
        q: () =>
          story.templatePieces(value, slots, lex).map((p, i) =>
            p.value ? (
              <span key={i} className="text-link">
                {p.text}
              </span>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          ),
      })}
    </span>
  );
}

/** A part of a sentence. A span, not a button: inherited items are shown in a disabled fieldset, and jumping must still work. */
function Seg({ part, onJump, children }: { part: Part; onJump: (p: Part) => void; children: ReactNode }) {
  const t = useTranslations("ruleSetEditor.story");
  return (
    <span
      role="button"
      tabIndex={0}
      className="cursor-pointer rounded-[var(--radius)] underline decoration-border decoration-dotted underline-offset-4 hover:bg-muted hover:decoration-link"
      data-part={part}
      onClick={() => onJump(part)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onJump(part);
        }
      }}
      title={t("segTitle")}
    >
      {children}
    </span>
  );
}

/** A rich-text tag that wraps its words in a Seg. */
function seg(part: Part, onJump: (p: Part) => void) {
  return function SegTag(chunks: ReactNode) {
    return (
      <Seg part={part} onJump={onJump}>
        {chunks}
      </Seg>
    );
  };
}

function SwitchNote({ enabled, slots }: { enabled: Value<boolean> | undefined; slots: Slots }) {
  const t = useTranslations("ruleSetEditor.story");
  const story = useStoryText();
  if (isRef(enabled)) {
    const on = slots[enabled.param]?.value === true;
    return <span className={cn(!on && "text-muted-foreground line-through")}>{t(on ? "switchOn" : "switchOff", { slot: story.slotName(enabled.param, slots) })} </span>;
  }
  if (enabled === false) return <span className="text-muted-foreground line-through">{t("switchedOff")} </span>;
  return null;
}

function FollowsNote({ entry, slots }: { entry: object; slots: Slots }) {
  const t = useTranslations("ruleSetEditor.story");
  const story = useStoryText();
  const fmt = useFmtParam();
  const used = answersUsed(entry);
  if (!used.length) return null;
  return (
    <span data-testid="story-follows">
      {t.rich("follows", {
        list: () =>
          used.map((n, i) => (
            <span key={n}>
              {t.rich("followsEntry", {
                first: i === 0 ? "yes" : "no",
                slot: story.slotName(n, slots),
                value: fmt(slots[n]),
                m: (c) => <span className="text-muted-foreground">{c}</span>,
              })}
            </span>
          )),
      })}
    </span>
  );
}

function Story({ sentence, meta }: { sentence: ReactNode; meta: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-muted/40 p-3 text-prose" data-testid="item-story">
      <p>{sentence}</p>
      <p className="text-muted-foreground">{meta}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- the sentences */

export function ItemStory({ item, slots, onJump }: { item: ItemRule; slots: Slots; onJump: (p: Part) => void }) {
  const t = useTranslations("ruleSetEditor.story");
  const story = useStoryText();
  const lex = useLexicon(slots);
  const { extra } = decomposeMatch(item.match);
  const q = item.quantity;
  const qty = story.qtyShort(q, slots, lex);
  const only = extra.filter((x) => !("not" in x)).map((x) => story.condWords(x, slots, lex));
  const except = extra.filter((x): x is { not: Selector } => "not" in x).map((x) => story.condWords(x.not, slots, lex));
  let what = story.whatShort(item.match);
  if (only.length) what = t("whatWhere", { what, cond: story.joinAnd(only) });
  if (except.length) what = t("whatExcept", { what, cond: story.joinOr(except) });
  const after = q.kind === "formula" || q.kind === "when" || q.kind === "choose" ? t("afterColon", { qty }) : q.kind === "count" && q.unit ? t("afterUnit", { unit: q.unit }) : "";
  const deductions = "deductions" in q ? (q.deductions ?? []).map((d) => story.deductionWords(d, slots, lex)).filter((x): x is string => !!x) : [];
  const keys = (item.lineKey ?? []).map((k) => story.lineKeyWords(String(k), slots, lex));
  const extras = story.itemExtras(item, slots);

  const sentence = t.rich("item", {
    kind: q.kind,
    qty,
    what,
    hasAfter: after ? "yes" : "no",
    after,
    hasDed: deductions.length ? "yes" : "no",
    deductions: deductions.join(t("semicolon")),
    lines: keys.length ? t("linePer", { keys: keys.join(t("semicolon")) }) : t("oneLine"),
    how: seg("how", onJump),
    whatSeg: seg("what", onJump),
    linesSeg: seg("lines", onJump),
    text: () => (
      <Seg part="text" onJump={onJump}>
        <TemplateWords value={item.description} slots={slots} />
      </Seg>
    ),
  });
  return (
    <Story
      sentence={sentence}
      meta={
        <>
          <SwitchNote enabled={item.enabled} slots={slots} />
          {extras.length > 0 && <span>{t.rich("also", { extras: extras.join(t("comma")), more: seg("more", onJump) })} </span>}
          <FollowsNote entry={item} slots={slots} />
        </>
      }
    />
  );
}

export function DerivedStory({ rule, slots, ruleLabel, onJump }: { rule: DerivedRule; slots: Slots; ruleLabel: (id: string) => string; onJump: (p: Part) => void }) {
  const t = useTranslations("ruleSetEditor.story");
  const story = useStoryText();
  const lex = useLexicon(slots);
  const formula = isRef(rule.quantity) ? story.formulaAnswer(rule.quantity.param, slots, lex) : story.prose(rule.quantity, lex) || t("emptyFormula");
  const lines =
    rule.lineKey === undefined ? t("linesSource")
    : rule.lineKey.length === 0 ? t("oneLine")
    : t("linePer", { keys: rule.lineKey.map((k) => story.lineKeyWords(String(k), slots, lex)).join(t("semicolon")) });
  const sentence = t.rich("derived", {
    scope: rule.scope,
    from: rule.from.length ? story.joinAnd(rule.from.map((f) => t("slotName", { label: ruleLabel(f) }))) : t("noItem"),
    hasWhere: rule.where ? "yes" : "no",
    where: rule.where ? story.prose(rule.where, lex) : "",
    formula,
    unit: rule.unit,
    lines,
    whatSeg: seg("what", onJump),
    how: seg("how", onJump),
    linesSeg: seg("lines", onJump),
    text: () => (
      <Seg part="text" onJump={onJump}>
        <TemplateWords value={rule.description} slots={slots} />
      </Seg>
    ),
  });
  return (
    <Story
      sentence={sentence}
      meta={
        <>
          <SwitchNote enabled={rule.enabled} slots={slots} />
          <FollowsNote entry={rule} slots={slots} />
        </>
      }
    />
  );
}

export function ManualStory({ item, slots, onJump }: { item: ManualItem; slots: Slots; onJump: (p: Part) => void }) {
  const t = useTranslations("ruleSetEditor.story");
  const story = useStoryText();
  const lex = useLexicon(slots);
  const qty =
    item.formula !== undefined ? t("calculatedAs", { formula: isRef(item.formula) ? story.formulaAnswer(item.formula.param, slots, lex) : story.prose(item.formula, lex) })
    : item.quantity === undefined ? t("leftToFill")
    : isRef(item.quantity) ? String(slots[item.quantity.param]?.value ?? "?")
    : String(item.quantity);
  const amount = item.amount === undefined ? "" : String(isRef(item.amount) ? (slots[item.amount.param]?.value ?? "?") : item.amount);
  const sentence = t.rich("manual", {
    kind: t(`manualKind.${item.kind}`),
    qty,
    unit: item.unit,
    hasAmount: amount ? "yes" : "no",
    amount,
    name: seg("name", onJump),
    how: seg("how", onJump),
    text: () => (
      <Seg part="text" onJump={onJump}>
        <TemplateWords value={item.description} slots={slots} />
      </Seg>
    ),
  });
  return (
    <Story
      sentence={sentence}
      meta={
        <>
          <SwitchNote enabled={item.enabled} slots={slots} />
          <FollowsNote entry={item} slots={slots} />
        </>
      }
    />
  );
}
