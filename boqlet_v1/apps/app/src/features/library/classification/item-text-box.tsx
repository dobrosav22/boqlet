"use client";

/**
 * The item text of a code (F10 §13): the Code list tab's box under each code (typed, with values
 * inserted by a click, read back in words and, with a preview, as a sample), and the sample under
 * a row of the Codes per line tab. Ported from the rule-set editor's line text (item-forms.tsx
 * `DescriptionEditor`). Nothing is evaluated here: the engine fills the blanks (BR-01).
 */
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { textareaClass } from "../shared/fields";
import { useVocab } from "../shared/use-vocab";
import { ITEM_TEXT_NAMES, insertBlank, itemTextPieces, type PreviewLine } from "./item-text";
import { useCodes } from "./nav";

/** The words for a name an item text can use. */
function useNameLabel() {
  const t = useTranslations("classificationEditor.itemText");
  const vocab = useVocab();
  return (name: string) => (name === "unit" || name === "quantity" ? t(`names.${name}`) : vocab.nameLabel(name));
}

/**
 * An item text in words, in quotes. Without a line, each plain blank reads as its name; with one,
 * as that line's value (a blank the line has no value for stays as written, as in a run).
 * Expressions always stay as written.
 */
export function ItemTextWords({ template, line }: { template: string; line?: PreviewLine | null }) {
  const t = useTranslations("classificationEditor.itemText");
  const label = useNameLabel();
  return (
    <span>
      {t.rich("quoted", {
        q: () =>
          itemTextPieces(template, line).map((p, i) =>
            "text" in p ? (
              <span key={i}>{p.text}</span>
            ) : p.value !== undefined ? (
              <span key={i} className="text-link" title={p.name && label(p.name)}>
                {p.value}
              </span>
            ) : p.name && !line ? (
              <span key={i} className="text-link">
                {label(p.name)}
              </span>
            ) : (
              <span key={i} className="font-mono text-muted-foreground">
                {p.blank}
              </span>
            ),
          ),
      })}
    </span>
  );
}

export interface Sample {
  line: PreviewLine;
  /** The BoQ item the line comes from, in words. */
  item: string;
}

/**
 * The Code list tab's item text box. Typing stays local and is saved on leaving the box, so a page
 * of codes doesn't re-render on every key; an insert saves at once. The insert buttons show only
 * for the active box (the one last focused), so a page of 200 codes stays light.
 */
export function ItemTextBox({ code, value, onCommit, active, onActivate, sample }: {
  code: string;
  value: string | undefined;
  /** The new text; undefined removes the item text. */
  onCommit: (v: string | undefined) => void;
  active: boolean;
  onActivate: () => void;
  sample?: Sample;
}) {
  const t = useTranslations("classificationEditor.itemText");
  const label = useNameLabel();
  const area = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(value ?? "");
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value ?? "");
  }
  const commit = (text: string) => {
    const next = text.trim() ? text : undefined;
    if (next !== value) onCommit(next);
  };
  const insert = (name: string) => {
    const el = area.current;
    const r = insertBlank(draft, name, el?.selectionStart ?? draft.length, el?.selectionEnd ?? draft.length);
    setDraft(r.text);
    commit(r.text);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(r.caret, r.caret);
    });
  };
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <textarea
        ref={area}
        className={cn(textareaClass, "font-mono")}
        rows={draft.includes("\n") || draft.length > 90 ? 3 : 1}
        value={draft}
        placeholder={t("placeholder")}
        aria-label={t("label", { code })}
        spellCheck={false}
        onFocus={onActivate}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        data-testid="item-text"
        data-code={code}
      />
      {active && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="label-caps text-muted-foreground">{t("insert")}</span>
          {ITEM_TEXT_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              className="rounded-[var(--radius)] border border-border px-1.5 py-0.5 hover:bg-muted"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(name)}
              data-testid="item-text-insert"
              data-name={name}
            >
              {t("insertValue", { what: label(name) })}
            </button>
          ))}
        </div>
      )}
      {draft.trim() && (
        <div className="flex flex-col text-muted-foreground" data-testid="item-text-reads">
          <span>
            {t("readsAs")} <ItemTextWords template={draft} />
          </span>
          {sample && (
            <span data-testid="item-text-sample">
              {t("sample", { item: sample.item })} <ItemTextWords template={draft} line={sample.line} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Under a Codes per line row: the item text of the chosen code, filled from the preview's first
 * line of that BoQ item when there is a preview, else in words.
 */
export function LineSample({ code, line }: { code: string | null | undefined; line?: PreviewLine }) {
  const t = useTranslations("classificationEditor.itemText");
  const { texts } = useCodes();
  const template = code ? texts.get(code) : undefined;
  if (!code || !template) return null;
  return (
    <span className="text-muted-foreground" data-testid="line-sample-text" data-code={code}>
      {t("lineSample", { filled: line ? "yes" : "no" })} <ItemTextWords template={template} line={line} />
    </span>
  );
}
