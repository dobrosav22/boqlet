"use client";

/**
 * The dictionary in a few sentences (the PoC's `dictStory.tsx`): what a dictionary does, which one
 * wins when several know a name, and links into the tabs. The per-entry, per-term and per-reader
 * sentences are in dict-words.ts; `useDictWords()` gives them in the user's language.
 */
import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Dictionary } from "@ifc-boq/types";
import { useStoryWords } from "../shared/story";
import { useVocab } from "../shared/use-vocab";
import { dictWords, type DictWords } from "./dict-words";

export type DictPart = "names" | "entries" | "terms" | "extractors" | "about";

export function useDictWords(): DictWords {
  const t = useTranslations("dictionaryEditor.words");
  const story = useStoryWords();
  const vocab = useVocab();
  return useMemo(() => {
    const lex = vocab.lexicon({});
    return dictWords(t, story.joinOr, story.joinAnd, (expr) => story.prose(expr, lex));
  }, [t, story, vocab]);
}

const first = (v: string | string[]) => (Array.isArray(v) ? v[0] : v);

export function DictStory({ doc, label, onJump }: { doc: Dictionary; label: (id: string) => string | undefined; onJump: (p: DictPart) => void }) {
  const t = useTranslations("dictionaryEditor.story");
  const words = useDictWords();
  // A span, not a button: the jumps must keep working when the editor is read-only (disabled fieldset).
  const jump = (to: DictPart) => {
    const Jump = (children: ReactNode) => (
      <span
        role="button"
        tabIndex={0}
        className="cursor-pointer text-link hover:underline"
        data-testid={`dict-jump-${to}`}
        onClick={() => onJump(to)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onJump(to);
          }
        }}
      >
        {children}
      </span>
    );
    return Jump;
  };
  const example = doc.entries.find((e) => "exact" in e.match) ?? doc.entries[0];
  const m = example?.match;
  const exampleRaw = m ? first("exact" in m ? m.exact : "startsWith" in m ? m.startsWith : "contains" in m ? m.contains : m.regex) : undefined;
  const exact = doc.entries.filter((e) => "exact" in e.match).length;
  return (
    <div className="prose-text flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-3" data-testid="dict-story">
      <p>
        {t.rich("intro", {
          b: (c) => <b>{c}</b>,
          about: jump("about"),
          name: doc.name || doc.id,
          layer: words.layer(doc.layer),
          hasExample: example && exampleRaw ? "yes" : "no",
          raw: exampleRaw ?? "",
          term: example ? (label(example.term) ?? example.term) : "",
        })}
      </p>
      <p className="text-muted-foreground">
        {t.rich("knows", {
          entries: jump("entries"),
          terms: jump("terms"),
          extractors: jump("extractors"),
          names: jump("names"),
          nameCount: doc.entries.length,
          termCount: doc.terms?.length ?? 0,
          partial: doc.entries.length > exact ? "yes" : "no",
          exact,
          loose: doc.entries.length - exact,
          readers: doc.extractors?.length ?? 0,
        })}
      </p>
      <p className="text-muted-foreground">{t("layers")}</p>
    </div>
  );
}
