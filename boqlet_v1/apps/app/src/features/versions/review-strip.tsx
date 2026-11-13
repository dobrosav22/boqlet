"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Boq } from "@/api/hooks/boqs";
import { useApprove, useWithdrawReview } from "@/api/hooks/versions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { useRelativeTime } from "@/i18n/use-relative-time";
import { RequestChangesDialog } from "./version-dialogs";

/**
 * A version in review or approved (F09 §4): who submitted it to whom, or who approved it; Approve and
 * Request changes for reviewers (four-eyes is the server's: the buttons follow `permissions.approve`),
 * Withdraw review (BR-23: the only way to change it; the reviewers are told), and the Review tab.
 */
export function ReviewStrip({ boq, base, compact }: { boq: Boq; base: string; compact?: boolean }) {
  const t = useTranslations("boqs.review");
  const relative = useRelativeTime();
  const message = useErrorMessage();
  const revision = boq.currentRevision;
  const p = revision.permissions;
  const approve = useApprove(revision.id, boq.id, boq.projectId);
  const withdraw = useWithdrawReview(revision.id, boq.id, boq.projectId);
  const [requesting, setRequesting] = useState(false);
  if (revision.status !== "in_review" && revision.status !== "approved") return null;
  const reviewers = (revision.reviewers ?? []).map((r) => r.name).join(", ");
  const error = approve.error ?? withdraw.error;

  return (
    <div className="flex flex-col gap-2 border-l-2 border-[var(--blue)] pl-3" role="status" data-testid="review-strip" data-status={revision.status}>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          {revision.status === "in_review"
            ? t("inReview", { by: revision.submittedBy?.name ?? "", when: revision.submittedAt ? relative(revision.submittedAt) : "", reviewers })
            : t("approved", { by: revision.approvedBy?.name ?? "", when: revision.approvedAt ? relative(revision.approvedAt) : "" })}
        </span>
        {compact && (
          <Link href={`${base}?tab=review`} className="text-link hover:underline" data-testid="open-review">
            {t("open")}
          </Link>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {p.approve && (
          <>
            <Button onClick={() => approve.mutate(undefined)} disabled={approve.isPending} data-testid="approve">
              {t("approve")}
            </Button>
            <Button variant="outline" onClick={() => setRequesting(true)} data-testid="request-changes">
              {t("requestChanges")}
            </Button>
          </>
        )}
        {revision.status === "in_review" && !p.approve && revision.submittedBy && (revision.reviewers ?? []).length > 0 && <span className="text-muted-foreground">{t("waiting")}</span>}
        {p.withdraw && (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" data-testid="withdraw-review">
                {t("withdraw")}
              </Button>
            }
            title={t("withdrawTitle")}
            body={t("withdrawBody", { reviewers: reviewers || "—" })}
            confirm={t("withdraw")}
            onConfirm={() => withdraw.mutateAsync()}
            testId="withdraw-confirm"
          />
        )}
      </div>
      {!p.withdraw && !p.approve && <p className="text-muted-foreground">{t("readOnly")}</p>}
      {p.withdraw && <p className="text-muted-foreground">{t("editHint")}</p>}
      {error ? (
        <p role="alert" className="text-error">
          {message(error)}
        </p>
      ) : null}
      {p.approve && <RequestChangesDialog boq={boq} open={requesting} onOpenChange={setRequesting} />}
    </div>
  );
}
