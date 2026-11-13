"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { RuleSet } from "@ifc-boq/types";
import type { Preset, PresetKind } from "@/api/hooks/library";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JsonTab } from "./shared/json-tab";
import type { Draft, SaveStatus } from "./shared/use-draft";

/** What every kind's editor gets (F10 §3). */
export interface EditorProps<D = unknown> {
  preset: Preset;
  doc: D;
  onChange: (doc: D) => void;
  /** Rule-set patches: the parent as the engine flattens it. */
  parent: RuleSet | null;
  /** The Settings question to open (`?question=<slot>`, from "How it is calculated"). */
  question?: string | null;
}

function AdvancedJson({ doc, onChange }: EditorProps) {
  return <JsonTab value={doc} onChange={onChange} />;
}

const loading = () => <div aria-busy="true" className="h-40" />;

type AnyEditor = ComponentType<EditorProps>;

/** The editors are separate chunks (architecture.md "Performance budgets"). */
const EDITORS: Record<PresetKind, AnyEditor> = {
  rule_set: dynamic(() => import("./rule-set/rule-set-editor").then((m) => m.RuleSetEditor as unknown as AnyEditor), { loading }),
  classification: dynamic(() => import("./classification/classification-editor").then((m) => m.ClassificationEditor as unknown as AnyEditor), { loading }),
  dictionary: dynamic(() => import("./dictionary/dictionary-editor").then((m) => m.DictionaryEditor as unknown as AnyEditor), { loading }),
  federation: AdvancedJson,
  resolution: AdvancedJson,
};

/**
 * The preset's document in its editor. Editors and the people allowed to edit get autosave; anyone
 * else sees the same editor with every control disabled.
 */
export function PresetEditor({ preset, draft, editable, question }: { preset: Preset; draft: Draft<unknown>; editable: boolean; question?: string | null }) {
  const t = useTranslations("library.edit");
  const message = useErrorMessage();
  const Editor = EDITORS[preset.kind];
  if (draft.doc === undefined) return loading();
  return (
    <div className="flex flex-col gap-4" data-testid="preset-editor" data-status={draft.status}>
      {editable && (
        <p className="text-muted-foreground" role="status" data-testid="save-status">
          {statusText(t, draft.status)}
          {draft.status === "error" && draft.error ? ` ${message(draft.error)}` : null}
        </p>
      )}
      {draft.problems.length > 0 && (
        <div className="flex flex-col gap-1 rounded-[var(--radius)] border border-error p-3" role="status" data-testid="draft-problems">
          <p className="label-caps text-error">{t("problems", { n: draft.problems.length })}</p>
          <ul className="list-disc pl-5">
            {draft.problems.map((problem, i) => (
              <li key={i}>{problem}</li>
            ))}
          </ul>
          <p className="text-muted-foreground">{t("problemsHint")}</p>
        </div>
      )}
      <fieldset disabled={!editable} className="min-w-0">
        <Editor preset={preset} doc={draft.doc} onChange={(d) => draft.setDoc(d)} parent={draft.parent} question={question} />
      </fieldset>
      <Dialog open={draft.conflict}>
        <DialogContent data-testid="draft-conflict" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("conflictTitle")}</DialogTitle>
            <DialogDescription>{t("conflictBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => void draft.reload()} data-testid="conflict-reload">
              {t("conflictReload")}
            </Button>
            <Button onClick={() => void draft.overwrite()} data-testid="conflict-overwrite">
              {t("conflictOverwrite")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function statusText(t: ReturnType<typeof useTranslations>, status: SaveStatus) {
  switch (status) {
    case "pending":
      return t("statusPending");
    case "saving":
      return t("statusSaving");
    case "saved":
      return t("statusSaved");
    case "conflict":
      return t("statusConflict");
    case "error":
      return t("statusError");
    default:
      return t("statusIdle");
  }
}
