"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { textareaClass } from "./fields";

/** Raw JSON of a draft (the editors' Advanced › JSON): everything the forms don't cover can be edited here. */
export function JsonTab<T>({ value, onChange, note }: { value: T; onChange: (v: T) => void; note?: string }) {
  const t = useTranslations("library.json");
  const text = JSON.stringify(value, null, 2);
  const [draft, setDraft] = useState(text);
  const [seen, setSeen] = useState(text);
  const [error, setError] = useState<string | null>(null);
  if (text !== seen) {
    setSeen(text);
    setDraft(text);
    setError(null);
  }
  const dirty = draft !== text;
  const apply = () => {
    try {
      onChange(JSON.parse(draft) as T);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="flex flex-col gap-2" data-testid="json-tab">
      <p className="text-muted-foreground">{note ?? t("note")}</p>
      <textarea className={cn(textareaClass, "font-mono")} spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} rows={28} aria-label={t("label")} data-testid="json-area" />
      <div className="flex items-center gap-2">
        <Button type="button" disabled={!dirty} onClick={apply} data-testid="json-apply">
          {t("apply")}
        </Button>
        <Button type="button" variant="outline" disabled={!dirty} onClick={() => setDraft(text)}>
          {t("discard")}
        </Button>
        {error && (
          <span className="text-error" role="alert">
            {t("invalid", { error })}
          </span>
        )}
      </div>
    </div>
  );
}
