"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import { useModels } from "@/api/hooks/models";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadButton } from "@/features/models/upload-button";
import { VersionStatus } from "@/features/models/version-status";
import { useOrg } from "@/features/orgs/org-context";
import { useProjectScope } from "@/features/projects/project-context";

const DISCIPLINES = ["detect", "architecture", "structure", "mep"] as const;

/** S08: the project's models with their latest version, add a model, upload (F03). */
export default function ModelsPage() {
  const t = useTranslations("models");
  const message = useErrorMessage();
  const { org } = useOrg();
  const { project, can } = useProjectScope();
  const models = useModels(project.id);
  const router = useRouter();
  const client = useQueryClient();
  const base = `/${org.slug}/projects/${project.id}/models`;
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState<string>("detect");

  const create = useMutation({
    mutationFn: async () => (await api.POST("/projects/{projectId}/models", { params: { path: { projectId: project.id } }, body: { name: name.trim(), discipline } })).data!,
    onSuccess: async () => {
      setName("");
      await client.invalidateQueries({ queryKey: keys.models(project.id) });
    },
    onError: () => {},
  });

  return (
    <div className="flex flex-col gap-8">
      {can("editModels") && (
        <form
          className="flex max-w-2xl items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
          data-testid="add-model"
        >
          <Field id="model-name" label={t("list.name")} className="flex-1" error={create.error ? message(create.error) : undefined}>
            <Input id="model-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("list.namePlaceholder")} data-testid="model-name" />
          </Field>
          <Field id="model-discipline" label={t("list.discipline")}>
            <NativeSelect id="model-discipline" value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
              {DISCIPLINES.map((d) => (
                <option key={d} value={d}>
                  {t(`disciplines.${d}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Button type="submit" disabled={!name.trim() || create.isPending} data-testid="add-model-submit">
            {t("list.add")}
          </Button>
        </form>
      )}
      {models.isError && (
        <p role="alert" className="text-error">
          {message(models.error)}
        </p>
      )}
      {models.data?.length === 0 && <p className="text-muted-foreground">{t("list.empty")}</p>}
      <ul className="flex flex-col divide-y divide-border border-y border-border" data-testid="models-list">
        {models.data?.map((m) => (
          <li key={m.id} className="grid grid-cols-[1fr_auto] items-start gap-6 py-4" data-testid={`model-${m.name}`}>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline gap-3">
                <Link href={`${base}/${m.id}`} className="text-title hover:underline">
                  {m.name}
                </Link>
                <span className="label-caps text-muted-foreground">{t.has(`disciplines.${m.discipline}`) ? t(`disciplines.${m.discipline}`) : m.discipline}</span>
              </div>
              {m.latestVersion ? (
                <div className="flex flex-col gap-1">
                  <Link href={`${base}/${m.id}/versions/${m.latestVersion.id}`} className="text-muted-foreground hover:underline">
                    {t("list.latest", { number: m.latestVersion.number, file: m.latestVersion.fileName })}
                  </Link>
                  <VersionStatus version={m.latestVersion} detailed />
                </div>
              ) : (
                <p className="text-muted-foreground">{t("list.noVersion")}</p>
              )}
            </div>
            {can("editModels") && (
              <UploadButton
                modelId={m.id}
                variant={m.latestVersion ? "outline" : "default"}
                label={m.latestVersion ? t("list.uploadNew") : t("list.upload")}
                onUploaded={(v) => router.push(`${base}/${m.id}/versions/${v.id}`)}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
