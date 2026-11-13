"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useModels, useModelVersions } from "@/api/hooks/models";
import { useProjects } from "@/api/hooks/projects";
import { NativeSelect } from "@/components/native-select";
import { useOrg } from "@/features/orgs/org-context";

export interface PickedModelVersion {
  projectId: string;
  modelId: string;
  versionId: string;
}

/**
 * Project → model → ready version, for previews (F10 §6). A project-layer preset previews on its own
 * project only (`projectId`).
 */
export function ModelVersionPicker({ projectId: fixedProject, value, onChange }: { projectId?: string | null; value: PickedModelVersion | null; onChange: (v: PickedModelVersion | null) => void }) {
  const t = useTranslations("library.preview");
  const { org } = useOrg();
  const projects = useProjects(org.id, { status: "active" });
  const [projectChoice, setProjectChoice] = useState<string | null>(null);
  const projectId = fixedProject ?? value?.projectId ?? projectChoice ?? "";
  const models = useModels(projectId);
  const [modelChoice, setModelChoice] = useState<string | null>(null);
  const modelId = value?.modelId ?? modelChoice ?? "";
  const versions = useModelVersions(modelId);
  const ready = (versions.data ?? []).filter((v) => v.status === "ready");
  return (
    <div className="flex flex-wrap gap-2" data-testid="preview-picker">
      {!fixedProject && (
        <NativeSelect
          aria-label={t("project")}
          value={projectId}
          onChange={(e) => {
            setProjectChoice(e.target.value || null);
            setModelChoice(null);
            onChange(null);
          }}
          data-testid="preview-project"
        >
          <option value="">{t("pickProject")}</option>
          {(projects.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      )}
      {projectId && (
        <NativeSelect
          aria-label={t("model")}
          value={modelId}
          onChange={(e) => {
            setModelChoice(e.target.value || null);
            onChange(null);
          }}
          data-testid="preview-model"
        >
          <option value="">{t("pickModel")}</option>
          {(models.data ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </NativeSelect>
      )}
      {modelId && (
        <NativeSelect
          aria-label={t("version")}
          value={value?.versionId ?? ""}
          onChange={(e) => onChange(e.target.value ? { projectId, modelId, versionId: e.target.value } : null)}
          data-testid="preview-version"
        >
          <option value="">{ready.length ? t("pickVersion") : t("noReadyVersion")}</option>
          {ready.map((v) => (
            <option key={v.id} value={v.id}>
              {t("versionN", { n: v.number })}
            </option>
          ))}
        </NativeSelect>
      )}
    </div>
  );
}
