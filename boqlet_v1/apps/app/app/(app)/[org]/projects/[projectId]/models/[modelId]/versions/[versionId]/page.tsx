"use client";

import { use } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useModel, useModelVersion } from "@/api/hooks/models";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { InputCheckReport } from "@/features/models/input-check-report";
import { NamesPreview } from "@/features/models/names-preview";
import { VersionStatus } from "@/features/models/version-status";

/** S10: one version: live processing, then the input-check report and the names preview (F03 §5). */
export default function ModelVersionPage({ params }: { params: Promise<{ modelId: string; versionId: string }> }) {
  const { modelId, versionId } = use(params);
  const t = useTranslations("models.report");
  const format = useFormatter();
  const message = useErrorMessage();
  const model = useModel(modelId);
  const version = useModelVersion(versionId);

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
      <VersionStatus version={v} detailed />
      {v.status === "ready" && v.summary && (
        <>
          <InputCheckReport summary={v.summary} />
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
