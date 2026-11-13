"use client";

/**
 * Words shared by the editors' plain-language sentences (the PoC's `itemStory.tsx` helpers `cap`,
 * `fieldWords`, `prose`, used by the rule-set, classification and dictionary stories). Sentences are
 * built from `library.story` messages with ICU parameters (reuse-from-poc.md, F15).
 */
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { Selector } from "@ifc-boq/types";
import { toReadable, type Lexicon } from "../lib/readable";
import { useVocab } from "./use-vocab";

export const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
/** Lower-case the first letter unless the word is an abbreviation ("IFC class"). */
export const lc = (s: string) => (s.length > 1 && s[1] === s[1]!.toLowerCase() ? s[0]!.toLowerCase() + s.slice(1) : s);
export const listOf = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === "" ? [] : [v]);

/** A match as "kinds of element" plus further conditions: `{ifcClass}` or `{all: [{ifcClass}, …]}`. */
export function decomposeMatch(s: Selector): { classes: string[]; extra: Selector[] } {
  if ("ifcClass" in s) return { classes: listOf(s.ifcClass).map(String), extra: [] };
  if ("all" in s) {
    const first = s.all[0];
    return first && "ifcClass" in first ? { classes: listOf(first.ifcClass).map(String), extra: s.all.slice(1) } : { classes: [], extra: s.all };
  }
  return { classes: [], extra: [s] };
}
export function composeMatch(classes: string[], extra: Selector[]): Selector {
  const parts: Selector[] = [...(classes.length ? [{ ifcClass: classes.length === 1 ? classes[0]! : classes }] : []), ...extra];
  return parts.length === 1 ? parts[0]! : parts.length === 0 ? { ifcClass: [] } : { all: parts };
}

export interface StoryWords {
  /** "a, b and c" in the user's language. */
  joinAnd: (list: string[]) => string;
  joinOr: (list: string[]) => string;
  /** A field name in words: "type_name" -> "type name", "props.Pset_WallCommon.FireRating" -> "property …". */
  fieldWords: (field: string) => string;
  /**
   * A formula in prose: readable names without brackets, and a few common shapes in words ("= null"
   * as "is empty", COALESCE(a, b) as "a or b", UNDER(Material, "concrete") as "material is a kind of
   * concrete", IFC class = "IfcWall" as "element kind is walls"). Only words: nothing is evaluated.
   */
  prose: (expr: string, lex: Lexicon) => string;
}

export function useStoryWords(): StoryWords {
  const t = useTranslations("library.story");
  const vocab = useVocab();
  return useMemo(() => {
    const join = (list: string[], key: "and" | "or") =>
      list.length <= 1 ? list.join("") : t(key, { head: list.slice(0, -1).join(t("comma")), last: list[list.length - 1]! });
    return {
      joinAnd: (l) => join(l, "and"),
      joinOr: (l) => join(l, "or"),
      fieldWords: (f) => (f.startsWith("props.") ? t("property", { name: f.slice(6) }) : vocab.nameLabel(f) !== f ? lc(vocab.nameLabel(f)) : f.replace(/_/g, " ")),
      prose: (expr, lex) =>
        toReadable(expr, lex)
          .replace(/\[([^\]]+)\]/g, "$1")
          .replace(/\s*!=\s*null\b/gi, ` ${t("isFilledIn")}`)
          .replace(/\s*=\s*null\b/gi, ` ${t("isEmpty")}`)
          .replace(/\bCOALESCE\(([^()]*)\)/g, (_, args: string) => args.split(",").map((a) => a.trim()).join(` ${t("orWord")} `))
          .replace(/\bUNDER\(\s*([^,()"]+?)\s*,\s*"([^"]+)"\s*\)/g, (_, f: string, term: string) => t("kindOf", { what: lc(f), term }))
          .replace(/\bIFC class\s*(!=|=)\s*"(Ifc\w+)"/g, (_, op: string, c: string) => t(op === "=" ? "classIs" : "classIsNot", { classes: vocab.classWords(c) }))
          .replace(/"[^"]*"|\b(AND|OR|NOT)\b/g, (m, word?: string) => (word ? t(`logic.${word.toLowerCase()}`) : m)),
    } satisfies StoryWords;
  }, [t, vocab]);
}
