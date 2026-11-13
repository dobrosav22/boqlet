"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { api } from "@/api/client";
import { useDecisions, useTerms, type Answer, type Decision } from "@/api/hooks/decisions";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tag } from "@/features/boqs/boq-header";
import { useOrg } from "@/features/orgs/org-context";
import { useProjectScope } from "@/features/projects/project-context";
import { AnswerControl } from "@/features/questions/answer-control";
import { useAnswerFlow } from "@/features/questions/answer-flow";
import { describeAnswer } from "@/features/questions/model";
import { PromoteDialog } from "@/features/questions/promote-dialog";

/**
 * S13 Decisions (F05 §7): every answer of the project, who gave it and when, whether the latest
 * runs used it; edit, clear, promote (library editors) and the CSV export. A name answer whose term
 * is in none of the project's dictionaries any more is marked (F05 edge cases).
 */
export function DecisionsTable() {
  const t = useTranslations("questions.decisions");
  const tq = useTranslations("questions");
  const format = useFormatter();
  const message = useErrorMessage();
  const { org, can: orgCan } = useOrg();
  const { project, can } = useProjectScope();
  const decisions = useDecisions(project.id);
  const terms = useTerms(org.id, project.id);
  const flow = useAnswerFlow(project.id);
  const [kind, setKind] = useState("");
  const [editing, setEditing] = useState<Decision | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<unknown>(null);
  const byId = useMemo(() => new Map((terms.data ?? []).map((x) => [x.id, x])), [terms.data]);
  const canAnswer = can("answerQuestions");
  const list = decisions.data ?? [];
  const kinds = [...new Set(list.map((d) => d.kind))];
  const shown = list.filter((d) => !kind || d.kind === kind);

  async function exportCsv() {
    setExportError(null);
    try {
      const { data } = await api.GET("/projects/{projectId}/decisions.csv", { params: { path: { projectId: project.id } }, parseAs: "blob" });
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `decisions-${(project.code ?? project.name).replace(/[^\w.-]+/g, "-")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e);
    }
  }

  if (decisions.isError) return <p role="alert" className="text-error">{message(decisions.error)}</p>;
  if (!decisions.data) return <div className="h-40" aria-busy="true" />;

  return (
    <section className="flex flex-col gap-4" data-testid="decisions-page">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-title">{t("title")}</h2>
        {list.length > 0 && (
          <label className="flex items-center gap-2">
            <span className="label-caps text-muted-foreground">{tq("filters.kind")}</span>
            <NativeSelect value={kind} onChange={(e) => setKind(e.target.value)} data-testid="decisions-kind">
              <option value="">{tq("filters.allKinds")}</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {tq.has(`kinds.${k}`) ? tq(`kinds.${k}`) : k}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        <Button variant="outline" className="ml-auto" onClick={exportCsv} disabled={list.length === 0} data-testid="decisions-export">
          <Download aria-hidden />
          {t("export")}
        </Button>
      </div>
      <p className="max-w-3xl text-muted-foreground">{t("intro")}</p>
      {(flow.error || exportError !== null) && (
        <p role="alert" className="text-error">
          {flow.error ?? message(exportError)}
        </p>
      )}
      {list.length === 0 ? (
        <p className="text-muted-foreground" data-testid="decisions-empty">
          {t("empty")}
        </p>
      ) : (
        <Table data-testid="decisions-table">
          <TableHeader>
            <TableRow>
              <TableHead>{t("kind")}</TableHead>
              <TableHead>{t("question")}</TableHead>
              <TableHead>{t("answer")}</TableHead>
              <TableHead>{t("decided")}</TableHead>
              <TableHead>{t("note")}</TableHead>
              <TableHead>{t("used")}</TableHead>
              <TableHead className="sr-only">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((d) => {
              const shownAnswer = describeAnswer(d.answer, d.answerType, { terms: byId });
              const termGone = d.kind === "unknown_name" && typeof d.answer === "string" && terms.isSuccess && !byId.has(d.answer);
              const promotable = orgCan("promoteDecisions") && d.kind === "unknown_name" && typeof d.answer === "string";
              return (
                <TableRow key={d.id} data-testid="decision-row" data-question-id={d.questionId}>
                  <TableCell className="whitespace-nowrap">{tq.has(`kinds.${d.kind}`) ? tq(`kinds.${d.kind}`) : d.kind}</TableCell>
                  <TableCell className="max-w-md whitespace-normal">{d.summary ?? d.questionId}</TableCell>
                  <TableCell className="whitespace-normal">
                    <span data-testid="decision-answer">{"text" in shownAnswer ? shownAnswer.text : tq(`special.${shownAnswer.special}`)}</span>
                    {termGone && (
                      <Tag className="ml-2 border-[var(--status-error)]" data-testid="term-gone">
                        {t("termGone")}
                      </Tag>
                    )}
                    {d.promotedToPresetVersionId && <Tag className="ml-2 border-muted-foreground text-muted-foreground">{t("promoted")}</Tag>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {t("decidedBy", { name: d.decidedBy?.name ?? "", when: format.dateTime(new Date(d.decidedAt), { dateStyle: "medium", timeStyle: "short" }) })}
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-normal text-muted-foreground">{d.note ?? ""}</TableCell>
                  <TableCell data-testid="decision-used">{d.usedByLatestRuns ? t("yes") : t("no")}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {canAnswer && (
                      <>
                        <Button variant="ghost" onClick={() => setEditing(d)} data-testid="decision-edit">
                          {t("edit")}
                        </Button>
                        <Button variant="ghost" disabled={flow.busy} onClick={() => flow.remove(d)} data-testid="decision-clear">
                          {tq("clear")}
                        </Button>
                      </>
                    )}
                    {promotable && (
                      <Button variant="ghost" onClick={() => setPromoting(d.id)} data-testid="decision-promote">
                        {tq("promoteAction")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {editing && <EditDialog decision={editing} terms={terms.data ?? []} busy={flow.busy} onSave={(answer, note) => flow.submit({ decisions: [{ questionId: editing.questionId, kind: editing.kind, answer, ...(note ? { note } : {}) }] }, () => setEditing(null))} onClose={() => setEditing(null)} />}
      {promoting && <PromoteDialog orgId={org.id} projectId={project.id} decisionIds={[promoting]} open onOpenChange={(open) => !open && setPromoting(null)} />}
      {flow.dialog}
    </section>
  );
}

function EditDialog({ decision, terms, busy, onSave, onClose }: { decision: Decision; terms: Parameters<typeof AnswerControl>[0]["context"]["terms"]; busy: boolean; onSave: (answer: Answer, note: string) => void; onClose: () => void }) {
  const t = useTranslations("questions.decisions");
  const [value, setValue] = useState<Answer | undefined>(decision.answer);
  const [note, setNote] = useState(decision.note ?? "");
  // Without the question's control (it was never asked by a run here), the answer is typed.
  const type = decision.answerType ?? (decision.kind === "unknown_name" ? { kind: "term" as const } : { kind: "rule" as const });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="decision-edit-dialog">
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>{decision.summary ?? decision.questionId}</DialogDescription>
        </DialogHeader>
        <AnswerControl type={type} value={value} context={{ terms }} label={t("answer")} testId="decision-edit-answer" onChange={(v) => setValue(v)} />
        <label className="flex flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("note")}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="rounded-[var(--radius)] border border-input bg-transparent px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button disabled={busy || value === undefined} onClick={() => value !== undefined && onSave(value, note.trim())} data-testid="decision-save">
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
