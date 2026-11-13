"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { saveFile } from "@/api/hooks/exports";
import type { Preset } from "@/api/hooks/library";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Draft } from "./shared/use-draft";

type ImportResult = Schemas["TemplateImportResult"];

export const hasTemplate = (kind: Preset["kind"]) => kind === "rule_set" || kind === "classification" || kind === "dictionary";

/** Downloads a preset's Excel template (`source`: the draft, the latest version, or empty). */
export function useDownloadTemplate() {
  return useMutation({
    mutationFn: async ({ preset, source }: { preset: Pick<Preset, "id" | "slug">; source: "draft" | "latest" | "empty" }) => {
      const blob = (await api.GET("/presets/{presetId}/template.xlsx", { params: { path: { presetId: preset.id }, query: { source } }, parseAs: "blob" })).data as unknown as Blob;
      saveFile(blob, `${preset.slug}${source === "empty" ? "-template" : ""}.xlsx`);
    },
  });
}

/**
 * F10 §14 in the editor: "Download as Excel" and "Upload from Excel". An upload shows the changes it
 * would make and the problems by sheet, row and column; nothing is saved until "Apply", which puts the
 * proposed document into the draft (autosaved like any edit).
 */
export function TemplateTools({ preset, draft, editable }: { preset: Preset; draft: Draft<unknown>; editable: boolean }) {
  const t = useTranslations("library.template");
  const message = useErrorMessage();
  const download = useDownloadTemplate();
  const file = useRef<HTMLInputElement>(null);
  const [review, setReview] = useState<ImportResult | null>(null);
  const read = useMutation({
    mutationFn: async (f: File) => {
      await draft.flush();
      const form = new FormData();
      form.append("file", f);
      return (await api.POST("/presets/{presetId}/template-import", { params: { path: { presetId: preset.id } }, body: form as never, bodySerializer: (b) => b as unknown as FormData })).data!;
    },
    onSuccess: setReview,
    onError: () => {},
  });
  if (!hasTemplate(preset.kind)) return null;
  return (
    <>
      <Button variant="outline" onClick={() => download.mutate({ preset, source: "draft" })} disabled={download.isPending} data-testid="template-download">
        {t("download")}
      </Button>
      {editable && (
        <>
          <Button variant="outline" onClick={() => file.current?.click()} disabled={read.isPending} data-testid="template-upload">
            {read.isPending ? t("reading") : t("upload")}
          </Button>
          <input
            ref={file}
            type="file"
            accept=".xlsx"
            className="hidden"
            data-testid="template-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) read.mutate(f);
              e.target.value = "";
            }}
          />
        </>
      )}
      {read.isError && (
        <p role="alert" className="w-full text-error">
          {message(read.error)}
        </p>
      )}
      <Dialog open={review !== null} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent data-testid="template-review" className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("reviewTitle")}</DialogTitle>
            <DialogDescription>{review && (review.changes.length ? t("changes", { n: review.changes.length }) : t("noChanges"))}</DialogDescription>
          </DialogHeader>
          {review && review.problems.length > 0 && (
            <div className="flex flex-col gap-1" role="alert" data-testid="template-problems">
              <p className="label-caps text-error">{t("problems", { n: review.problems.length })}</p>
              <ul className="max-h-48 list-disc overflow-auto pl-5">
                {review.problems.map((p, i) => (
                  <li key={i} data-testid="template-problem">
                    {p.sheet ? t("where", { sheet: p.sheet, row: p.row ?? 0, column: p.column ?? "", hasRow: p.row ? "yes" : "no" }) : null}
                    {p.message}
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground">{t("problemsHint")}</p>
            </div>
          )}
          {review && review.changes.length > 0 && (
            <ul className="max-h-72 list-disc overflow-auto pl-5" data-testid="template-changes">
              {review.changes.map((c, i) => (
                <li key={i} data-testid="template-change" data-what={c.what}>
                  {c.summary}
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("cancel")}</DialogClose>
            <Button
              disabled={!review || review.changes.length === 0}
              onClick={() => {
                if (!review) return;
                draft.setDoc(review.doc);
                setReview(null);
              }}
              data-testid="template-apply"
            >
              {t("apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
