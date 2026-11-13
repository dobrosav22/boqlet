"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/api/client";
import { isApiError } from "@/api/errors";
import { usePresetVersion, type Preset } from "@/api/hooks/library";
import { useProject } from "@/api/hooks/projects";
import { useSaveOrgSetup, type OrgSetup } from "@/api/hooks/setup";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/features/orgs/org-context";

type Kind = "rules" | "items" | "names";
const STEP_OF: Record<Kind, OrgSetup["step"]> = { rules: "measure", items: "items", names: "names" };

interface Doc {
  params?: Record<string, unknown>;
  codeList?: { codes?: unknown[] };
  map?: { rules?: unknown[] };
  entries?: unknown[];
  terms?: unknown[];
}

/**
 * F16 step 4 "Review and publish": what the three drafts hold, in plain words; their problems with the
 * step that fixes them; "Publish all" publishes them with "Initial setup" and stars them, so they
 * prefill new projects' defaults (F02 §2); optionally the preview model's project takes them as its
 * defaults (no existing revision changes, BR-07). A classification with no codes or a dictionary with no
 * names is left as a draft (skipped steps).
 */
export function ReviewStep({ rules, items, names, modelProjectId, onEdit }: { rules: Preset; items: Preset; names: Preset; modelProjectId: string | null; onEdit: (step: OrgSetup["step"]) => void }) {
  const t = useTranslations("setup.review");
  const message = useErrorMessage();
  const router = useRouter();
  const client = useQueryClient();
  const { org } = useOrg();
  const save = useSaveOrgSetup(org.id);
  const project = useProject(modelProjectId ?? "", !!modelProjectId);
  const [apply, setApply] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ kind: Kind; error: unknown } | null>(null);
  const docOf = (p: Preset) => p.draft ?? p.latestPublishedVersion;
  const r = usePresetVersion(docOf(rules)?.id, rules.draft?.etag);
  const i = usePresetVersion(docOf(items)?.id, items.draft?.etag);
  const n = usePresetVersion(docOf(names)?.id, names.draft?.etag);
  if (!r.data || !i.data || !n.data) return <div aria-busy="true" className="h-40" />;
  const rd = r.data.doc as Doc;
  const id = i.data.doc as Doc;
  const nd = n.data.doc as Doc;
  const codes = id.codeList?.codes?.length ?? 0;
  const entries = nd.entries?.length ?? 0;
  const rows: { kind: Kind; preset: Preset; summary: string; problems: string[]; publish: boolean }[] = [
    { kind: "rules", preset: rules, summary: t("rulesSummary", { n: Object.keys(rd.params ?? {}).length }), problems: r.data.problems, publish: true },
    { kind: "items", preset: items, summary: codes ? t("itemsSummary", { codes, rules: id.map?.rules?.length ?? 0 }) : t("itemsNone"), problems: i.data.problems, publish: codes > 0 },
    { kind: "names", preset: names, summary: entries ? t("namesSummary", { n: entries }) : t("namesNone"), problems: n.data.problems, publish: entries > 0 || (nd.terms?.length ?? 0) > 0 },
  ];
  const blocked = rows.some((row) => row.publish && row.problems.length > 0);

  const publishAll = async () => {
    setBusy(true);
    setError(null);
    const published: Partial<Record<Kind, string>> = {};
    for (const row of rows) {
      if (!row.publish) continue;
      try {
        let versionId = row.preset.latestPublishedVersion?.id;
        if (row.preset.draft) versionId = (await api.POST("/presets/{presetId}/publish", { params: { path: { presetId: row.preset.id } }, body: { changeNote: t("changeNote") } })).data!.id;
        await api.PATCH("/presets/{presetId}", { params: { path: { presetId: row.preset.id } }, body: { starred: true } });
        if (versionId) published[row.kind] = versionId;
      } catch (e) {
        setError({ kind: row.kind, error: e });
        setBusy(false);
        return;
      }
    }
    if (apply && project.data && published.rules) {
      const d = project.data.defaults;
      await api.PATCH("/projects/{projectId}", {
        params: { path: { projectId: project.data.id } },
        body: {
          defaults: {
            ruleSetVersionId: published.rules,
            classificationVersionIds: published.items ? [published.items] : (d.classificationVersionIds ?? []),
            dictionaryVersionIds: published.names ? [...(d.dictionaryVersionIds ?? []), published.names] : (d.dictionaryVersionIds ?? []),
            ...(d.federationVersionId !== undefined ? { federationVersionId: d.federationVersionId } : {}),
          },
        },
      });
    }
    await save.mutateAsync({ status: "done", step: "review" });
    await client.invalidateQueries({ queryKey: ["presets"] });
    setBusy(false);
    router.push(`/${org.slug}`);
  };

  return (
    <div className="flex flex-col gap-5" data-testid="setup-review">
      <div className="flex flex-col gap-1">
        <h2 className="text-title">{t("title")}</h2>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.kind} className="flex flex-col gap-1 rounded-[var(--radius)] border border-border p-3" data-testid="setup-review-row" data-kind={row.kind}>
            <div className="flex items-baseline gap-2">
              <span className="flex-1 font-medium">{row.preset.name}</span>
              <button type="button" className="text-link hover:underline" onClick={() => onEdit(STEP_OF[row.kind])}>
                {t("change")}
              </button>
            </div>
            <p>{row.summary}</p>
            {!row.publish && <p className="text-muted-foreground">{t("staysDraft")}</p>}
            {row.problems.length > 0 && (
              <ul className="list-disc pl-5 text-error" data-testid="setup-review-problems">
                {row.problems.map((p, k) => (
                  <li key={k}>{p}</li>
                ))}
              </ul>
            )}
            {error?.kind === row.kind && (
              <p role="alert" className="text-error">
                {isApiError(error.error) && error.error.code === "draft_has_problems" ? t("fixFirst") : message(error.error)}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="rounded-[var(--radius)] border border-border bg-muted p-3" data-testid="setup-not-in-models">
        {t("notInModels")}
      </p>
      {project.data && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} data-testid="setup-apply-project" />
          {t("applyTo", { project: project.data.name })}
        </label>
      )}
      <div className="flex gap-2">
        <Button onClick={publishAll} disabled={blocked || busy} data-testid="setup-publish-all">
          {busy ? t("publishing") : t("publishAll")}
        </Button>
      </div>
      {blocked && <p className="text-error">{t("blocked")}</p>}
    </div>
  );
}
