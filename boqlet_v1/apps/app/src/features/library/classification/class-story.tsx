"use client";

/**
 * Classifications in plain words (the PoC's `classStory.tsx`): what a classification does, how a
 * BoQ line gets its code, and for each kind of BoQ line which map rules give it a code. The logic
 * is in `model.ts`; the sentences come from `classificationEditor` messages with ICU parameters.
 *
 * "Which rules apply" is worked out from what is known without a model: a rule aimed at a BoQ item
 * (by its id, its tags, or the kind of a hand-entered line) applies to that item's lines for sure;
 * a condition on line values (material, element type…) may apply to some of them. Conditions are
 * only shown in words, never evaluated (CLAUDE.md rule 4); the BoQ itself shows each line's code.
 */
import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ClassificationMap, CodeList, CodeTarget, LineMatch } from "@ifc-boq/types";
import { useStoryWords } from "../shared/story";
import { useVocab } from "../shared/use-vocab";
import { asList, coverage as coverageOf, sourceCode, type Cond, type LineKind, type Outcome, type Step } from "./model";
import { Jump, NavLink } from "./nav";

export type JumpTarget = "table" | "codes" | "rules" | "settings";

/** Rules, conditions and codes in words. */
export function useClassWords() {
  const t = useTranslations("classificationEditor.words");
  const story = useStoryWords();
  const vocab = useVocab();
  const lex = useMemo(() => vocab.lexicon({}), [vocab]);
  return useMemo(() => {
    const quote = (text: string) => t("quoted", { text });
    const manualKind = (k: string) => (t.has(`manualKinds.${k}`) ? t(`manualKinds.${k}`) : k.replace(/_/g, " "));
    const cond = (c: Cond): string =>
      "where" in c ? story.prose(c.where, lex) : "not" in c ? t("not", { what: cond(c.not) }) : "all" in c ? story.joinAnd(c.all.map(cond)) : story.joinOr(c.any.map(cond));
    const match = (m: LineMatch, label: (id: string) => string): string => {
      if ("all" in m) return story.joinAnd(m.all.map((x) => match(x, label)));
      if ("any" in m) return t("either", { list: story.joinOr(m.any.map((x) => match(x, label))) });
      if ("not" in m) return t("not", { what: match(m.not, label) });
      if ("ruleId" in m) {
        const ids = asList(m.ruleId).filter(Boolean);
        return t("linesOf", { items: ids.length ? story.joinOr(ids.map((id) => quote(label(id)))) : t("noItem") });
      }
      if ("tag" in m) {
        const tags = asList(m.tag).filter(Boolean);
        return t("linesTagged", { tags: tags.length ? story.joinOr(tags) : t("noTag") });
      }
      if ("manualKind" in m) return t("linesByHand", { kinds: story.joinOr(asList(m.manualKind).map(manualKind)) });
      return m.where ? t("linesWhere", { cond: story.prose(m.where, lex) }) : t("emptyCondition");
    };
    const code = (target: CodeTarget, titles: Map<string, string>): string => {
      if (typeof target === "string") {
        if (!target) return t("noCode");
        const title = titles.get(target);
        return title === undefined ? t("codeUnknown", { code: target }) : t("code", { code: target, title });
      }
      if ("fromSource" in target) return t("fromSource");
      return t("lookup", { field: story.fieldWords(target.lookup), n: Object.keys(target.table).length, hasDefault: target.default ? "yes" : "no", fallback: target.default ?? "" });
    };
    /** A rule's code in a few words (the rules list). */
    const short = (target: CodeTarget, titles: Map<string, string>): string =>
      typeof target === "string"
        ? `${target} ${titles.get(target) ?? ""}`.trim() || t("shortNone")
        : "fromSource" in target
          ? t("shortSource")
          : t("shortLookup", { field: story.fieldWords(target.lookup) });
    /** Under a line kind's name: its tags, what it is calculated from, or its hand-entered kind. */
    const kindSub = (k: LineKind): string =>
      k.orphan
        ? t("notInRuleSet")
        : k.group === "derived"
          ? t("from", { items: (k.from ?? []).join(t("comma")) })
          : k.group === "manual"
            ? manualKind(k.manualKind ?? "")
            : k.tags.length
              ? t("tags", { tags: k.tags.join(t("comma")) })
              : "";
    return { quote, cond, match, code, short, kindSub, manualKind };
  }, [t, story, lex]);
}

export type ClassWords = ReturnType<typeof useClassWords>;

/** Under a row of the Codes per line table: what else decides its code, in the engine's order. */
export function OutcomeWords({ outcome, titles, kind, kinds, map, table, onOpenRule }: {
  outcome: Outcome;
  /** Indexes of the map rules the table writes. */
  table: Set<number>;
  titles: Map<string, string>;
  kind: LineKind;
  kinds: LineKind[];
  map: ClassificationMap;
  onOpenRule: (index: number) => void;
}) {
  const t = useTranslations("classificationEditor.outcome");
  const w = useClassWords();
  const code = (s: Step): ReactNode => {
    if (typeof s.code === "object" && "fromSource" in s.code) {
      const c = sourceCode(map, kind, kinds);
      return t("sourceCode", { has: c ? "yes" : "no", code: c ?? "", title: (c && titles.get(c)) ?? "" });
    }
    return <b>{w.code(s.code, titles)}</b>;
  };
  const by = (s: Step): ReactNode =>
    table.has(s.index) ? (
      <span className="text-muted-foreground">{t("byTable")}</span>
    ) : (
      <span className="text-muted-foreground">
        {t.rich("byRule", {
          id: s.rule.id,
          link: (chunks) => (
            <NavLink onClick={() => onOpenRule(s.index)} data-testid="outcome-rule">
              {chunks}
            </NavLink>
          ),
        })}
      </span>
    );
  const sentence = (key: "when" | "base", s: Step, values: Record<string, string>) =>
    t.rich(key, { ...values, code: () => code(s), by: () => by(s) });
  const { ifs, base, general } = outcome;
  if (!ifs.length && !general.length && base && table.has(base.index)) return null; // the picker above says it all
  const after = ifs.length ? "yes" : "no";
  return (
    <span className="flex flex-col gap-0.5" data-testid="outcome">
      {ifs.map((s) => (
        <span key={s.index}>{sentence("when", s, { when: s.when ? w.cond(s.when) : "" })}</span>
      ))}
      {base ? (
        <span>{sentence("base", base, { after })}</span>
      ) : (
        <span className="text-muted-foreground">{general.length ? t("rulesForAny", { after }) : t("noRule", { after })}</span>
      )}
    </span>
  );
}

/** The classification in a few sentences: what it does and where a line's code comes from. */
export function ClassStory({ codeList, map, table, kinds, ruleSetName, onJump }: {
  codeList: CodeList;
  map: ClassificationMap;
  table: Set<number>;
  kinds: LineKind[] | null;
  ruleSetName?: string;
  onJump: (to: JumpTarget) => void;
}) {
  const t = useTranslations("classificationEditor.story");
  const w = useClassWords();
  const sources = map.sources ?? ["decision", "map"];
  const coverage = useMemo(() => (kinds ? coverageOf(map, kinds) : null), [kinds, map]);
  const byCondition = map.rules.length - table.size;
  const unm = map.onUnmapped;
  const jump = (to: JumpTarget) => {
    const Tag = (chunks: ReactNode) => <Jump onClick={() => onJump(to)}>{chunks}</Jump>;
    return Tag;
  };
  const step: Record<"decision" | "ifc" | "map", ReactNode> = {
    decision: t("stepDecision"),
    ifc: t.rich("stepIfc", { settings: jump("settings"), names: map.ifc?.systemNames.length ? map.ifc.systemNames.map(w.quote).join(t("or")) : t("noNames") }),
    map: t.rich("stepMap", { table: jump("table"), rules: jump("rules"), byCondition: Math.max(0, byCondition), ask: map.onConflict === "ask" ? "yes" : "no" }),
  };
  const unmappedCode = typeof unm === "object" ? unm.code : "";
  return (
    <div className="prose-text flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-3" data-testid="class-story">
      <p>
        {t.rich("intro", {
          b: (c) => <b>{c}</b>,
          codes: jump("codes"),
          name: codeList.name || codeList.id,
          n: codeList.codes.length,
          hasLevels: codeList.levels?.length ? "yes" : "no",
          levels: (codeList.levels ?? []).join(" › "),
        })}
      </p>
      <p className="text-muted-foreground">{t("order")}</p>
      <ol className="list-decimal pl-6">
        {sources.map((s) => (
          <li key={s}>{step[s]}</li>
        ))}
        <li>
          {t.rich("stepUnmapped", {
            settings: jump("settings"),
            mode: typeof unm === "string" ? unm : "code",
            code: unmappedCode,
            title: codeList.codes.find((c) => c.code === unmappedCode)?.title ?? "",
          })}
        </li>
      </ol>
      {coverage && kinds && (
        <p className="text-muted-foreground" data-testid="class-coverage">
          {t("coverage", { ruleSet: ruleSetName ?? t("chosenRuleSet"), total: kinds.length, sure: coverage.sure, some: coverage.some, none: coverage.none })}
        </p>
      )}
    </div>
  );
}
