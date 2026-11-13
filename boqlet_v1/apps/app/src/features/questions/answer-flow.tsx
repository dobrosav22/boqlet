"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useBoqs } from "@/api/hooks/boqs";
import { reopenedBy, useAnswer, useClearDecision, type AnswerRequest, type Decision, type RevisionRef } from "@/api/hooks/decisions";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

function otherAnswer(decision: Decision): string | number {
  const type = decision.answerType;
  if (type?.kind === "choice") return type.options[0]?.value ?? "";
  if (type?.kind === "number") return 0;
  return "-";
}

type Pending ={ kind: "answer"; request: AnswerRequest; revisions: RevisionRef[]; done?: () => void } | { kind: "clear"; decision: Decision; revisions: RevisionRef[]; done?: () => void };

/**
 * Saving answers with BR-23's warning (F05 §2): when a BoQ of the project is in review or approved,
 * a dry run lists the versions the change would send back to draft, and the person confirms first.
 * Otherwise the answer is saved in one request (F05 AC3).
 */
export function useAnswerFlow(projectId: string) {
  const t = useTranslations("questions.reopen");
  const message = useErrorMessage();
  const boqs = useBoqs(projectId);
  const answer = useAnswer(projectId);
  const clear = useClearDecision(projectId);
  const [pending, setPending] = useState<Pending | null>(null);
  const [checkError, setCheckError] = useState<unknown>(null);
  const [checking, setChecking] = useState(false);
  const atRisk = (boqs.data ?? []).some((b) => !b.archived && (b.currentRevision.status === "in_review" || b.currentRevision.status === "approved"));

  async function guarded(request: AnswerRequest, go: () => void, warn: (revisions: RevisionRef[]) => void) {
    setCheckError(null);
    if (!atRisk) return go();
    setChecking(true);
    try {
      const revisions = await reopenedBy(projectId, request);
      if (revisions.length) warn(revisions);
      else go();
    } catch (e) {
      setCheckError(e);
    } finally {
      setChecking(false);
    }
  }

  const submit = (request: AnswerRequest, done?: () => void) =>
    guarded(
      request,
      () => answer.mutate(request, { onSuccess: () => done?.() }),
      (revisions) => setPending({ kind: "answer", request, revisions, done }),
    );

  /**
   * Clearing changes the run like any other answer would; the dry run (which has no "clear") asks
   * with a different, valid answer: `null`, or for a dismissed question one its control accepts.
   */
  const remove = (decision: Decision, done?: () => void) =>
    guarded(
      { decisions: [{ questionId: decision.questionId, kind: decision.kind, answer: decision.answer === null ? otherAnswer(decision) : null }] },
      () => clear.mutate(decision.id, { onSuccess: () => done?.() }),
      (revisions) => setPending({ kind: "clear", decision, revisions, done }),
    );

  const confirm = () => {
    if (!pending) return;
    if (pending.kind === "answer") answer.mutate(pending.request, { onSuccess: () => pending.done?.() });
    else clear.mutate(pending.decision.id, { onSuccess: () => pending.done?.() });
    setPending(null);
  };

  const dialog = (
    <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
      <AlertDialogContent data-testid="reopen-warning">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("body", { count: pending?.revisions.length ?? 0 })}</AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="flex flex-col gap-1">
          {pending?.revisions.map((r) => (
            <li key={r.revisionId}>{t("revision", { boq: r.boqName, label: r.label, status: r.status })}</li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} data-testid="reopen-confirm">
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const error = checkError ?? answer.error ?? clear.error;
  return {
    submit,
    remove,
    dialog,
    busy: checking || answer.isPending || clear.isPending,
    error: error ? message(error) : null,
  };
}
