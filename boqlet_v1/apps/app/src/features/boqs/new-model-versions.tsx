"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import { useUpdateInputs, type Boq } from "@/api/hooks/boqs";
import { useModels } from "@/api/hooks/models";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { ReopenBoqDialog } from "./reopen-boq-dialog";

/** The models of the working version that have a newer ready version, with what the swap needs. */
export function newerModels(boq: Boq, names: Map<string, string>, versions: Map<string, { id: string; number: number }[]>) {
  return boq.currentRevision.inputs.models.flatMap((m) => {
    if (!m.newerVersionAvailable) return [];
    const list = versions.get(m.modelId) ?? [];
    const newer = list.find((v) => v.number === m.newerVersionAvailable);
    const current = list.find((v) => v.id === m.modelVersionId);
    return [{ modelId: m.modelId, name: names.get(m.modelId) ?? "", newer: m.newerVersionAvailable, newerId: newer?.id, current: current?.number }];
  });
}

/**
 * F08 §1, FL-3 step 3: "new version available" in the BoQ header. In the working version each model
 * with a newer ready version gets "Use vN", which swaps it into the inputs (a pending change: generate
 * again to see it). A confirmed BoQ shows the badge with "Reopen to update" (F09 §6, the lead's).
 */
export function NewModelVersions({ boq, base }: { boq: Boq; base: string }) {
  const t = useTranslations("boqs.newVersion");
  const message = useErrorMessage();
  const revision = boq.currentRevision;
  const show = boq.newModelVersionsAvailable && !boq.archived;
  const models = useModels(show ? boq.projectId : "");
  const withNewer = show ? revision.inputs.models.filter((m) => m.newerVersionAvailable) : [];
  const versions = useQueries({
    queries: withNewer.map((m) => ({
      queryKey: keys.modelVersions(m.modelId),
      queryFn: async () => (await api.GET("/models/{modelId}/versions", { params: { path: { modelId: m.modelId } } })).data!,
    })),
  });
  const update = useUpdateInputs(revision.id, boq.id);
  const [reopening, setReopening] = useState(false);
  if (!show) return null;

  const names = new Map((models.data ?? []).map((m) => [m.id, m.name]));
  const byModel = new Map(withNewer.map((m, i) => [m.modelId, versions[i]?.data ?? []]));
  const rows = newerModels(boq, names, byModel);
  const confirmed = boq.status === "confirmed";
  const canSwap = !confirmed && revision.permissions.editBoqs === true;
  const canReopen = confirmed && revision.permissions.reopen === true;

  const use = (modelIds: string[]) =>
    update.mutate({
      models: revision.inputs.models.map((m) => {
        const row = rows.find((r) => r.modelId === m.modelId && modelIds.includes(m.modelId));
        return { modelId: m.modelId, modelVersionId: row?.newerId ?? m.modelVersionId, discipline: m.discipline, ...(m.scope ? { scope: m.scope } : {}) };
      }),
    });

  return (
    <div className="flex flex-col gap-1 border-l-2 border-[var(--status-attention)] pl-3" role="status" data-testid="new-model-version" data-confirmed={confirmed}>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="label-caps">{t("badge")}</span>
        {canReopen && (
          <Button variant="outline" size="sm" onClick={() => setReopening(true)} data-testid="reopen-to-update">
            {t("reopenToUpdate")}
          </Button>
        )}
        {confirmed && !canReopen && <span className="text-muted-foreground">{t("confirmedAskLead")}</span>}
        {canSwap && rows.length > 1 && rows.every((r) => r.newerId) && (
          <Button variant="outline" size="sm" onClick={() => use(rows.map((r) => r.modelId))} disabled={update.isPending} data-testid="use-all-newer">
            {t("useAll")}
          </Button>
        )}
        <Link href={`${base}?tab=setup`} className="text-link hover:underline">
          {t("review")}
        </Link>
      </p>
      <ul className="flex flex-col gap-1">
        {rows.map((r) => (
          <li key={r.modelId} className="flex flex-wrap items-center gap-x-3" data-testid={`newer-${r.name}`}>
            <span>{r.current ? t("model", { model: r.name, newer: r.newer, current: r.current }) : t("modelNoCurrent", { model: r.name, newer: r.newer })}</span>
            {canSwap && (
              <Button size="sm" onClick={() => use([r.modelId])} disabled={update.isPending || !r.newerId} data-testid={`use-newer-version-${r.name}`}>
                {t("use", { number: r.newer })}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {update.error ? (
        <p role="alert" className="text-error">
          {message(update.error)}
        </p>
      ) : null}
      {canReopen && <ReopenBoqDialog boq={boq} open={reopening} onOpenChange={setReopening} forUpdate />}
    </div>
  );
}
