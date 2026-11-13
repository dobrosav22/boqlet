"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { Param } from "@ifc-boq/types";
import { lexicon, type Lexicon } from "../lib/readable";

export type VocabGroup =
  | "ops"
  | "quantityKinds"
  | "quantityKindWords"
  | "surfaces"
  | "lengthBases"
  | "massBases"
  | "start"
  | "deductWhat"
  | "deductModes"
  | "breakdowns"
  | "nameGroups"
  | "classGroups";

export interface Vocab {
  /** The words for a value of one of the editors' lists; the value itself (underscores as spaces) if none. */
  words: (group: VocabGroup, key: string) => string;
  /** An IFC class as people call it, plural ("walls"); unknown classes are spelled out from their name. */
  classWords: (ifcClass: string) => string;
  /** The label of a name formulas and selectors can read (`library.names`). */
  nameLabel: (name: string) => string;
  nameHelp: (name: string) => string | undefined;
  /** The readable-formula lexicon for a rule set's slots, with the catalogue's labels. */
  lexicon: (slots: Record<string, Param>) => Lexicon;
}

/** The Library's vocabulary in the user's language (F15). */
export function useVocab(): Vocab {
  const t = useTranslations("library.vocab");
  const tn = useTranslations("library.names");
  return useMemo(() => {
    const nameLabel = (name: string) => (tn.has(`${name}.label`) ? tn(`${name}.label`) : name);
    return {
      words: (group, key) => (t.has(`${group}.${key}`) ? t(`${group}.${key}`) : key.replace(/_/g, " ")),
      classWords: (c) => {
        if (t.has(`classWords.${c}`)) return t(`classWords.${c}`);
        const w = c.replace(/^Ifc/, "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
        return w.endsWith("s") ? w : `${w}s`;
      },
      nameLabel,
      nameHelp: (name) => (tn.has(`${name}.help`) ? tn(`${name}.help`) : undefined),
      lexicon: (slots) => lexicon(slots, nameLabel),
    } satisfies Vocab;
  }, [t, tn]);
}
