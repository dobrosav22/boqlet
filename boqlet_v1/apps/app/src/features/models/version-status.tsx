"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { useJobProgress } from "@/api/hooks/models";
import { DimensionRule } from "@/components/dimension-rule";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A version's state: a tag, live processing stages as a dimension line, or the failure with retry (F03 §2.5, §4). */
export function VersionStatus({ version, detailed = false }: { version: Schemas["ModelVersion"]; detailed?: boolean }) {
  const t = useTranslations("models.status");
  const progress = useJobProgress(version.status === "queued" || version.status === "processing" ? version.parseJobId : null);
  const client = useQueryClient();
  const retry = useMutation({
    mutationFn: async () => api.POST("/model-versions/{versionId}/retry", { params: { path: { versionId: version.id } } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["modelVersion", version.id] }),
  });

  const busy = version.status === "queued" || version.status === "processing";
  const stage = progress.data?.stage;
  return (
    <div className="flex flex-col gap-2" data-testid={`version-status-${version.id}`} data-status={version.status}>
      <span
        className={cn(
          "label-caps self-start rounded-[var(--radius)] border px-1",
          version.status === "failed" ? "border-[var(--status-error)] text-error" : "border-border",
        )}
      >
        {t(version.status)}
      </span>
      {busy && detailed && (
        <DimensionRule
          progress={(progress.data?.pct ?? 0) / 100}
          label={stage ? t(`stages.${stage}`) : t("waiting")}
          className="max-w-md"
        />
      )}
      {version.status === "failed" && detailed && (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-error">
            {version.error?.code && t.has(`errors.${version.error.code}`) ? t(`errors.${version.error.code}`) : version.error?.message}
          </p>
          {version.error?.code !== "not_ifc" && version.error?.code !== "unsupported_schema" && (
            <Button variant="outline" className="self-start" onClick={() => retry.mutate()} disabled={retry.isPending}>
              {t("retry")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
