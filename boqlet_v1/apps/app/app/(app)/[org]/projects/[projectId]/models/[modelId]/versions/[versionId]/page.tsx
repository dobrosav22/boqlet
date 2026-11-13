"use client";

import { use, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useModel, useModelVersion } from "@/api/hooks/models";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { InputCheckReport } from "@/features/models/input-check-report";
import { ModelViewer } from "@/features/viewer/model-viewer";
import { NamesPreview } from "@/features/models/names-preview";
import { VersionStatus } from "@/features/models/version-status";
import { Button } from "@/components/ui/button";
import { CreateBoqDialog } from "@/features/boqs/create-boq-dialog";
import { useOrg } from "@/features/orgs/org-context";
import { useProjectScope } from "@/features/projects/project-context";

/** S10: one version: live processing, then the input-check report and the names preview (F03 §5). */
export default function ModelVersionPage({ params }: { params: Promise<{ modelId: string; versionId: string }> }) {
  const { modelId, versionId } = use(params);
  const t = useTranslations("models.report");
  const format = useFormatter();
  const message = useErrorMessage();
  const model = useModel(modelId);
  const version = useModelVersion(versionId);
  const { org } = useOrg();
  const { project, can } = useProjectScope();
  const [generating, setGenerating] = useState(false);
  // The 3D view of this version (F07 §7: no run, so no coverage), open on a check's elements or on all.
  const [viewer, setViewer] = useState<{ guids: string[] | null } | null>(null);

  if (version.isError) return <p role="alert" className="text-error">{message(version.error)}</p>;
  if (!version.data) return <div className="h-40" aria-busy="true" />;
  const v = version.data;
  return (
    <div className="flex flex-col gap-8" data-testid="version-page">
      <div className="flex flex-col gap-2">
        <h2 className="text-title">{t("title", { model: model.data?.name ?? "", number: v.number })}</h2>
        <dl className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-x-6 gap-y-2">
          <Meta label={t("file")} value={v.fileName} />
          <Meta label={t("size")} value={t("mb", { mb: format.number(v.sizeBytes / (1024 * 1024), { maximumFractionDigits: 1 }) })} />
          {v.summary && <Meta label={t("schema")} value={v.summary.ifcSchema} />}
          {v.summary?.authoringApp && <Meta label={t("app")} value={v.summary.authoringApp} />}
          <Meta label={t("uploaded")} value={`${v.uploadedBy?.name ?? ""} · ${format.dateTime(new Date(v.uploadedAt), { dateStyle: "medium", timeStyle: "short" })}`} />
          {v.summary?.parseMs !== undefined && <Meta label={t("parseTime")} value={t("seconds", { s: format.number(v.summary.parseMs / 1000, { maximumFractionDigits: 1 }) })} />}
          {v.note && <Meta label={t("note")} value={v.note} />}
          {v.identicalToVersion && <Meta label={t("identical")} value={t("identicalTo", { number: v.identicalToVersion })} />}
        </dl>
      </div>
      <div className="flex items-start gap-6">
        <VersionStatus version={v} detailed />
        {v.status === "ready" && can("editBoqs") && (
          // F04 §1 "From a model": presets are chosen per BoQ, never per upload.
          <Button className="ml-auto" onClick={() => setGenerating(true)} data-testid="generate-boq-from-model">
            {t("generateBoq")}
          </Button>
        )}
      </div>
      {can("editBoqs") && (
        <CreateBoqDialog orgSlug={org.slug} orgId={org.id} project={project} open={generating} onOpenChange={setGenerating} fromModel={{ modelId, versionId: v.id }} />
      )}
      {v.status === "ready" && v.summary && (
        <>
          <div className="flex flex-col gap-3">
            <Button variant="outline" className="self-start" onClick={() => setViewer(viewer ? null : { guids: null })} data-testid="version-view-3d">
              {viewer ? t("close3d") : t("view3d")}
            </Button>
            {viewer && (
              <ModelViewer
                key={viewer.guids?.join(",") ?? "all"}
                models={[{ versionId: v.id, label: v.fileName }]}
                focusGuids={viewer.guids}
                className="h-[640px]"
              />
            )}
          </div>
          <InputCheckReport
            summary={v.summary}
            onShowIn3d={(guids) => {
              setViewer({ guids });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
          <NamesPreview versionId={v.id} />
        </>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="label-caps text-muted-foreground">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}
