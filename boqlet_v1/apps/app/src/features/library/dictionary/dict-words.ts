/**
 * Dictionaries in plain words (the PoC's `dictStory.tsx` sentence helpers): one sentence per entry,
 * meaning (term) and value reader (extractor). Built from `dictionaryEditor.words` messages with ICU
 * parameters (F15). Words only: patterns and conditions are shown, never run here.
 *
 * Pure, so the sentences can be tested with a translator made from the catalogue;
 * `useDictWords()` (dict-story.tsx) binds it to the user's language.
 */
import type { DictField, DictionaryEntry, Extractor, Term, TextMatch } from "@ifc-boq/types";

/** The part of next-intl's translator these helpers use. */
export interface Translate {
  (key: string, values?: Record<string, string | number>): string;
  has: (key: string) => boolean;
}

export interface DictWords {
  /** One field in words: "layer_material" -> "layer material", "props.X" -> "property X". */
  field: (f: string) => string;
  /** One or several fields: "material or layer material". */
  fields: (f: DictField | DictField[]) => string;
  /** A term category with examples ("product (brick, board, window unit…)"). */
  category: (c: string) => string;
  /** A term category, short ("product"). */
  categoryShort: (c: string) => string;
  /** What an extractor's output fills in. */
  target: (x: string) => string;
  layer: (l: string) => string;
  textMatch: (m: TextMatch) => string;
  /** A term id with its label, or a note that no dictionary defines it. */
  term: (id: string, label: (id: string) => string | undefined) => string;
  entry: (e: DictionaryEntry, label: (id: string) => string | undefined) => string;
  termSentence: (t: Term, label: (id: string) => string | undefined, names: number) => string;
  extractor: (x: Extractor) => string;
}

const list = <T>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);

/**
 * @param t       translator over the `dictionaryEditor.words` namespace
 * @param joinOr  "a, b or c" in the user's language (shared/story.ts)
 * @param joinAnd "a, b and c"
 * @param when    a condition (`when` formula) in prose (shared/story.ts `prose`)
 */
export function dictWords(t: Translate, joinOr: (l: string[]) => string, joinAnd: (l: string[]) => string, when: (expr: string) => string): DictWords {
  const known = (group: string, key: string) => (t.has(`${group}.${key}`) ? t(`${group}.${key}`) : key.replace(/_/g, " "));
  const field = (f: string) => (f.startsWith("props.") ? t("property", { name: f.slice(6) }) : known("fields", f));
  const fields = (f: DictField | DictField[]) => joinOr(list(f).map(field));
  const quoted = (l: string[]) => joinOr(l.map((text) => t("quoted", { text })));
  const textMatch = (m: TextMatch) => {
    if ("exact" in m) return t("match.exact", { values: quoted(list(m.exact)) });
    if ("startsWith" in m) return t("match.startsWith", { values: quoted(list(m.startsWith)) });
    if ("contains" in m) return t("match.contains", { values: quoted(list(m.contains)) });
    return t("match.regex", { pattern: m.regex });
  };
  const term = (id: string, label: (id: string) => string | undefined) => {
    const l = label(id);
    if (l) return t("termKnown", { label: l, id });
    return id ? t("termUnknown", { id }) : t("termNone");
  };
  const target = (x: string) => known("targets", x);
  return {
    field,
    fields,
    category: (c) => known("categories", c),
    categoryShort: (c) => known("categoriesShort", c),
    target,
    layer: (l) => known("layers", l),
    textMatch,
    term,
    entry: (e, label) =>
      t("entry", { fields: fields(e.field), match: textMatch(e.match), term: term(e.term, label), hasWhen: e.when ? "yes" : "no", when: e.when ? when(e.when) : "" }),
    termSentence: (x, label, names) =>
      t("term", {
        label: x.label,
        category: known("categoriesShort", x.category),
        hasBroader: x.broader ? "yes" : "no",
        broader: x.broader ? term(x.broader, label) : "",
        names,
      }),
    extractor: (x) => {
      const outs = Object.entries(x.outputs).map(([group, o]) => (o.unit ? t("outputUnit", { target: target(o.target), unit: o.unit, group }) : t("output", { target: target(o.target), group })));
      return t("extractor", {
        fields: fields(x.field),
        regex: x.regex,
        outputs: joinAnd(outs),
        hasWhen: x.when ? "yes" : "no",
        when: x.when ? when(x.when) : "",
        override: x.override ? "yes" : "no",
      });
    },
  };
}
