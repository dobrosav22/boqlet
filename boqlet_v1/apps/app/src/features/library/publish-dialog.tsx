"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { usePublishDraft, type Preset } from "@/api/hooks/library";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Draft } from "./shared/use-draft";

/**
 * Publish (F10 §4): a change note, then the draft becomes version n+1. Impossible while the draft has
 * problems; pending edits are saved first. Older versions stay as they are (read-only); BoQs pinned to
 * them keep them (BR-07).
 */
export function PublishDialog({ preset, draft }: { preset: Preset; draft: Draft<unknown> }) {
  const t = useTranslations("library.publish");
  const message = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const publish = usePublishDraft(preset.id);
  const next = (preset.latestPublishedVersion?.number ?? 0) + 1;
  const blocked = draft.problems.length > 0 || draft.conflict;
  return (
    <>
      <Button
        onClick={async () => {
          await draft.flush();
          setNote("");
          publish.reset();
          setOpen(true);
        }}
        disabled={draft.status === "saving"}
        data-testid="publish-open"
      >
        {t("open", { n: next })}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="publish-dialog">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (blocked || !note.trim()) return;
              publish.mutate(note.trim(), {
                onSuccess: (v) => {
                  setOpen(false);
                  toast(t("done", { n: v.number ?? next }));
                },
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("title", { name: preset.name, n: next })}</DialogTitle>
              <DialogDescription>{t("body", { n: next })}</DialogDescription>
            </DialogHeader>
            {blocked ? (
              <p className="text-error" role="alert" data-testid="publish-blocked">
                {draft.conflict ? t("conflict") : t("problems", { n: draft.problems.length })}
              </p>
            ) : (
              <Field id="publish-note" label={t("note")} hint={t("noteHint")} error={publish.error ? message(publish.error) : undefined}>
                <Input id="publish-note" value={note} onChange={(e) => setNote(e.target.value)} autoFocus data-testid="publish-note" />
              </Field>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>{t("cancel")}</DialogClose>
              <Button type="submit" disabled={blocked || !note.trim() || publish.isPending} data-testid="publish-confirm">
                {t("confirm", { n: next })}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
