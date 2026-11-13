"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Boq } from "@/api/hooks/boqs";
import { useManualItems } from "@/api/hooks/edits";
import { useProjectMembers } from "@/api/hooks/projects";
import { useMe } from "@/api/hooks/me";
import { useConfirmBoq, useRequestChanges, useSaveVersion, useSubmitForReview } from "@/api/hooks/versions";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NotInModelsText } from "@/features/boq-sheet/not-in-models";

const TEXTAREA = "rounded-[var(--radius)] border border-input bg-transparent px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** The blocking questions still open on the current run: saving is allowed and records them (P29, BR-22). */
function OpenQuestions({ boq, base }: { boq: Boq; base: string }) {
  const t = useTranslations("boqs.versions.dialog");
  const open = boq.currentRevision.currentRun?.stats?.blockingQuestions ?? 0;
  if (!open) return null;
  return (
    <p className="border-l-2 border-[var(--status-attention)] pl-3" role="status" data-testid="save-open-questions">
      {t("openQuestions", { count: open })}{" "}
      <Link href={`${base}?tab=questions`} className="text-link hover:underline">
        {t("seeQuestions")}
      </Link>
    </p>
  );
}

/** F09 §2 / BR-12: the "not in the models" reminder with the manual-line count, and the tick. */
function NotModelled({ boqId, checked, onChange }: { boqId: string; checked: boolean; onChange: (v: boolean) => void }) {
  const t = useTranslations("boqs.versions.dialog");
  const manual = useManualItems(boqId);
  return (
    <div className="flex flex-col gap-2 border-l-2 border-[var(--status-manual)] pl-3" data-testid="save-not-modelled">
      <NotInModelsText />
      <p className="text-muted-foreground">{t("manualCount", { count: manual.data?.length ?? 0 })}</p>
      <label className="flex items-start gap-2">
        <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid="save-not-modelled-tick" />
        <span>{t("tick")}</span>
      </label>
    </div>
  );
}

export type SaveMode = "save" | "saveApproved" | "confirm";

/**
 * Save version (F09 §2): label (the next letter, editable), note, the open questions and the "not in
 * the models" tick. `saveApproved` saves an approved version (the tick was given at submit); `confirm`
 * marks the BoQ as done (F09 §5) and saves a final version first if the working one changed.
 */
export function SaveVersionDialog({ boq, mode, open, onOpenChange, base, approval }: { boq: Boq; mode: SaveMode; open: boolean; onOpenChange: (v: boolean) => void; base: string; approval: boolean }) {
  const t = useTranslations("boqs.versions.dialog");
  const message = useErrorMessage();
  const revision = boq.currentRevision;
  const [label, setLabel] = useState(revision.label);
  const [note, setNote] = useState("");
  const [ticked, setTicked] = useState(false);
  const save = useSaveVersion(revision.id, boq.id, boq.projectId);
  const confirm = useConfirmBoq(boq.id, boq.projectId);
  const action = mode === "confirm" ? confirm : save;
  // With approval on, confirming needs the approved version saved already: nothing to fill in.
  const fields = !(mode === "confirm" && approval);
  const needsTick = mode === "save" || (mode === "confirm" && !approval);
  const run = () =>
    action.mutate(fields ? { ...(label.trim() && label.trim() !== revision.label ? { label: label.trim() } : {}), ...(note.trim() ? { note: note.trim() } : {}), ...(needsTick ? { notModelledConfirmed: ticked } : {}) } : {}, {
      onSuccess: () => onOpenChange(false),
    });

  return (
    <Dialog open={open} onOpenChange={(v) => !action.isPending && onOpenChange(v)}>
      <DialogContent data-testid="save-version-dialog" data-mode={mode} className="sm:max-w-xl">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <DialogHeader>
            <DialogTitle>{mode === "confirm" ? t("confirmTitle", { name: boq.name }) : mode === "saveApproved" ? t("saveApprovedTitle") : t("title")}</DialogTitle>
            <DialogDescription>{mode === "confirm" ? (approval ? t("confirmApproval") : t("confirmText", { label: revision.label })) : t("text")}</DialogDescription>
          </DialogHeader>
          {fields && (
            <>
              <Field id="version-label" label={t("label")} hint={mode === "confirm" ? t("labelConfirmHint") : t("labelHint")}>
                <Input id="version-label" value={label} onChange={(e) => setLabel(e.target.value)} className="max-w-48" data-testid="version-label" />
              </Field>
              <Field id="version-note" label={t("note")}>
                <textarea id="version-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={TEXTAREA} data-testid="version-note" />
              </Field>
              <OpenQuestions boq={boq} base={base} />
              {needsTick && <NotModelled boqId={boq.id} checked={ticked} onChange={setTicked} />}
            </>
          )}
          {action.error ? (
            <p role="alert" className="text-error" data-testid="save-version-error">
              {message(action.error)}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>{t("cancel")}</DialogClose>
            <Button type="submit" disabled={(needsTick && !ticked) || action.isPending} data-testid="save-version-submit">
              {mode === "confirm" ? t("confirm") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Submit for review (F09 §4): reviewers among the project's leads and approvers, a message, the tick. */
export function SubmitDialog({ boq, open, onOpenChange, base }: { boq: Boq; open: boolean; onOpenChange: (v: boolean) => void; base: string }) {
  const t = useTranslations("boqs.versions.dialog");
  const message = useErrorMessage();
  const me = useMe();
  const members = useProjectMembers(boq.projectId);
  const candidates = (members.data ?? []).filter((m) => m.role === "lead" || m.role === "approver");
  const [reviewers, setReviewers] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [ticked, setTicked] = useState(false);
  const submit = useSubmitForReview(boq.currentRevision.id, boq.id, boq.projectId);
  return (
    <Dialog open={open} onOpenChange={(v) => !submit.isPending && onOpenChange(v)}>
      <DialogContent data-testid="submit-dialog" className="sm:max-w-xl">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate({ reviewerIds: reviewers, ...(text.trim() ? { message: text.trim() } : {}), notModelledConfirmed: true }, { onSuccess: () => onOpenChange(false) });
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("submitTitle", { label: boq.currentRevision.label })}</DialogTitle>
            <DialogDescription>{t("submitText")}</DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="label-caps mb-1.5 text-muted-foreground">{t("reviewers")}</legend>
            {candidates.length === 0 && <p className="text-muted-foreground">{t("noReviewers")}</p>}
            {candidates.map((m) => (
              <label key={m.user.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={reviewers.includes(m.user.id)}
                  onChange={(e) => setReviewers((r) => (e.target.checked ? [...r, m.user.id] : r.filter((x) => x !== m.user.id)))}
                  data-testid="reviewer"
                  data-name={m.user.name}
                />
                {m.user.name}
                <span className="text-muted-foreground">
                  {t(`roles.${m.role}`)}
                  {m.user.id === me.data?.user.id ? ` · ${t("you")}` : ""}
                </span>
              </label>
            ))}
          </fieldset>
          <Field id="submit-message" label={t("message")}>
            <textarea id="submit-message" rows={2} value={text} onChange={(e) => setText(e.target.value)} className={TEXTAREA} data-testid="submit-message" />
          </Field>
          <OpenQuestions boq={boq} base={base} />
          <NotModelled boqId={boq.id} checked={ticked} onChange={setTicked} />
          {submit.error ? (
            <p role="alert" className="text-error">
              {message(submit.error)}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>{t("cancel")}</DialogClose>
            <Button type="submit" disabled={!ticked || reviewers.length === 0 || submit.isPending} data-testid="submit-review">
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Request changes (F09 §4): a comment is required; the version goes back to the working state. */
export function RequestChangesDialog({ boq, open, onOpenChange }: { boq: Boq; open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useTranslations("boqs.versions.dialog");
  const message = useErrorMessage();
  const [comment, setComment] = useState("");
  const send = useRequestChanges(boq.currentRevision.id, boq.id, boq.projectId);
  return (
    <Dialog open={open} onOpenChange={(v) => !send.isPending && onOpenChange(v)}>
      <DialogContent data-testid="request-changes-dialog">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (comment.trim()) send.mutate(comment.trim(), { onSuccess: () => onOpenChange(false) });
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("requestTitle")}</DialogTitle>
            <DialogDescription>{t("requestText")}</DialogDescription>
          </DialogHeader>
          <Field id="request-comment" label={t("comment")}>
            <textarea id="request-comment" rows={3} autoFocus value={comment} onChange={(e) => setComment(e.target.value)} className={TEXTAREA} data-testid="request-comment" />
          </Field>
          {send.error ? (
            <p role="alert" className="text-error">
              {message(send.error)}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>{t("cancel")}</DialogClose>
            <Button type="submit" disabled={!comment.trim() || send.isPending} data-testid="request-changes-submit">
              {t("requestChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
