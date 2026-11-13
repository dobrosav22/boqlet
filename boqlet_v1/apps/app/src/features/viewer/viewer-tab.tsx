"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Run } from "@/api/hooks/boqs";
import { useLines } from "@/api/hooks/sheet";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { ModelViewer, type ViewerModel } from "./model-viewer";

/** Most GlobalIds a "Show in 3D" link carries in its URL (F07 §7). */
export const MAX_LINK_GUIDS = 300;

/** The link that opens the Viewer tab on a line or on elements ("Show in 3D", F07 §7). */
export function showIn3dHref(base: string, target: { line: string } | { guids: readonly string[] }) {
  const q = new URLSearchParams({ tab: "viewer" });
  if ("line" in target) q.set("line", target.line);
  else q.set("guids", target.guids.slice(0, MAX_LINK_GUIDS).join(","));
  return `${base}?${q.toString()}`;
}

/** The run's model versions for the viewer, named by their file. */
export function viewerModels(run: Run | undefined): ViewerModel[] {
  return (run?.snapshotVersions?.models ?? []).map((m) => ({
    versionId: m.modelVersionId,
    traceId: m.traceId,
    label: run?.models?.find((r) => r.id === m.traceId)?.fileName ?? m.discipline,
  }));
}

/** The BoQ workspace's Viewer tab (F07): the current run's models, linked to its lines. */
export function ViewerTab({ run, base }: { run: Run | undefined; base: string }) {
  const t = useTranslations("boqs.sheet");
  const message = useErrorMessage();
  const search = useSearchParams();
  const router = useRouter();
  const lines = useLines(run?.id);
  const models = useMemo(() => viewerModels(run), [run]);
  const linkLines = useMemo(() => (lines.data ?? []).map((l) => ({ ...l, edited: !!l.overridden })), [lines.data]);
  const guids = useMemo(() => search.get("guids")?.split(",").filter(Boolean) ?? null, [search]);

  if (!run) return <p className="text-muted-foreground">{t("empty")}</p>;
  if (lines.isError) return <p role="alert" className="text-error">{message(lines.error)}</p>;
  return (
    <ModelViewer
      key={run.id}
      models={models}
      runId={run.id}
      lines={linkLines}
      systems={run.classifications ?? []}
      focusLine={search.get("line")}
      focusGuids={guids}
      onOpenLine={(key) => router.push(`${base}?${new URLSearchParams({ tab: "sheet", line: key }).toString()}`)}
      className="h-[calc(100vh-260px)]"
    />
  );
}
