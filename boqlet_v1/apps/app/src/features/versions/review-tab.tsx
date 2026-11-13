"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { Boq, Run } from "@/api/hooks/boqs";
import { useManualItems, useOverrides } from "@/api/hooks/edits";
import { useLines } from "@/api/hooks/sheet";
import { useReviewComment } from "@/api/hooks/versions";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { ChangesTab } from "@/features/changes/changes-tab";
import { useRelativeTime } from "@/i18n/use-relative-time";

/**
 * The review screen (F09 §4), under the header's review strip (the actions): the comments (overall or on a line), what the version
 * carries (open questions, line edits with their reasons, manual lines, warnings), then the change
 * report against the last saved version, as the reviewer reads it first.
 */
export function ReviewTab({ boq, runs, base }: { boq: Boq; runs: Run[] | undefined; base: string }) {
  const t = useTranslations("boqs.review");
  const format = useFormatter();
  const relative = useRelativeTime();
  const message = useErrorMessage();
  const revision = boq.currentRevision;
  const run = revision.currentRun;
  const lines = useLines(run?.id);
  const overrides = useOverrides(boq.id);
  const manual = useManualItems(boq.id);
  const comment = useReviewComment(revision.id, boq.id, boq.projectId);
  const [text, setText] = useState("");
  const [lineKey, setLineKey] = useState("");
  const describe = useMemo(() => new Map((lines.data ?? []).map((l) => [l.key, l.description])), [lines.data]);
  const comments = revision.reviewComments ?? [];
  const edited = overrides.data ?? [];

  return (
    <div className="flex flex-col gap-8" data-testid="review-tab">
      <p className="text-muted-foreground" data-testid="review-summary">
        {t("summary", { questions: run?.stats?.blockingQuestions ?? 0, edits: edited.length, manual: manual.data?.length ?? 0, warnings: run?.stats?.warnings ?? 0 })}
      </p>

      <section className="flex flex-col gap-3" data-testid="review-comments">
        <h3 className="label-caps">{t("comments")}</h3>
        {comments.length === 0 && <p className="text-muted-foreground">{t("noComments")}</p>}
        <ul className="flex flex-col gap-2">
          {comments.map((c) => (
            <li key={c.id} className="flex flex-col border-l-2 border-border pl-3" data-testid="review-comment" data-line={c.lineKey ?? ""} data-outcome={c.outcome ?? ""}>
              <span className="text-muted-foreground">
                {c.by.name} · {relative(c.at)}
                {c.outcome ? ` · ${t(`outcome.${c.outcome}`)}` : ""}
                {c.lineKey ? ` · ${describe.get(c.lineKey) ?? c.lineKey}` : ""}
              </span>
              {c.text && <span>{c.text}</span>}
            </li>
          ))}
        </ul>
        {revision.permissions.comment && (
          <form
            className="flex max-w-2xl flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              comment.mutate({ text: text.trim(), ...(lineKey ? { lineKey } : {}) }, { onSuccess: () => setText("") });
            }}
          >
            <label className="flex flex-col gap-1">
              <span className="label-caps text-muted-foreground">{t("line")}</span>
              <NativeSelect value={lineKey} onChange={(e) => setLineKey(e.target.value)} data-testid="review-comment-line">
                <option value="">{t("overall")}</option>
                {(lines.data ?? []).map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.description}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <textarea
              aria-label={t("addComment")}
              placeholder={t("addComment")}
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="rounded-[var(--radius)] border border-input bg-transparent px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="review-comment-text"
            />
            <Button type="submit" className="self-start" disabled={!text.trim() || comment.isPending} data-testid="review-comment-post">
              {t("post")}
            </Button>
            {comment.error ? (
              <p role="alert" className="text-error">
                {message(comment.error)}
              </p>
            ) : null}
          </form>
        )}
      </section>

      <section className="flex flex-col gap-2" data-testid="review-edits">
        <h3 className="label-caps">{t("edits")}</h3>
        {edited.length === 0 ? (
          <p className="text-muted-foreground">{t("noEdits")}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {edited.map((o) => (
              <li key={o.lineKey}>
                {describe.get(o.lineKey) ?? o.lineKey}
                {o.quantity !== undefined && o.quantity !== null ? ` → ${format.number(o.quantity, { maximumFractionDigits: 3 })}` : ""}
                {o.reason ? <span className="text-muted-foreground"> · {o.reason}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="label-caps">{t("changes")}</h3>
        <ChangesTab boq={boq} runs={runs} base={base} />
      </section>
    </div>
  );
}
