"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { saveFile } from "@/api/hooks/exports";
import { Button } from "@/components/ui/button";

const MAX_LINES = 1500;

/**
 * A preset document, read-only, as JSON (the editors' "Advanced" view). Large documents (a whole code
 * list) show their first lines and download in full.
 */
export function DocumentView({ doc, fileName = "preset.json" }: { doc: unknown; fileName?: string }) {
  const t = useTranslations("library.document");
  // The document's own key order (the diff sorts keys; a view shouldn't).
  const lines = useMemo(() => (JSON.stringify(doc ?? null, null, 2) ?? "null").split("\n"), [doc]);
  const shown = lines.length > MAX_LINES ? lines.slice(0, MAX_LINES) : lines;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <p className="label-caps flex-1 text-muted-foreground">{t("title")}</p>
        {lines.length > MAX_LINES && <p className="text-muted-foreground">{t("truncated", { shown: MAX_LINES, total: lines.length })}</p>}
        <Button variant="outline" size="sm" onClick={() => saveFile(new Blob([JSON.stringify(doc, null, 2) + "\n"], { type: "application/json" }), fileName)}>
          {t("download")}
        </Button>
      </div>
      <pre className="max-h-[60vh] overflow-auto rounded-[var(--radius)] border border-border bg-muted p-3 text-ui" data-testid="preset-doc">
        {shown.join("\n")}
      </pre>
    </div>
  );
}
