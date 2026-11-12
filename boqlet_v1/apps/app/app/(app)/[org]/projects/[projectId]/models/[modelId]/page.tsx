"use client";

import { use, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { api } from "@/api/client";
import { useModel, useModelVersions } from "@/api/hooks/models";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UploadButton } from "@/features/models/upload-button";
import { VersionStatus } from "@/features/models/version-status";
import { useOrg } from "@/features/orgs/org-context";
import { useProjectScope } from "@/features/projects/project-context";

const DISCIPLINES = ["architecture", "structure", "mep"];

/** S09: a model's versions and settings (F03 §6, §7). Scope rules come with the Library selectors (FE-021). */
export default function ModelPage({ params }: { params: Promise<{ modelId: string }> }) {
  const { modelId } = use(params);
  const t = useTranslations("models");
  const format = useFormatter();
  const message = useErrorMessage();
  const { org } = useOrg();
  const { project, can } = useProjectScope();
  const model = useModel(modelId);
  const versions = useModelVersions(modelId);
  const router = useRouter();
  const base = `/${org.slug}/projects/${project.id}/models/${modelId}`;

  if (model.isError) return <p role="alert" className="text-error">{message(model.error)}</p>;
  if (!model.data) return <div className="h-40" aria-busy="true" />;
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start gap-6">
        <div className="flex flex-1 flex-col gap-1">
          <h2 className="text-title" data-testid="model-title">
            {model.data.name}
          </h2>
          <span className="label-caps text-muted-foreground">{t.has(`disciplines.${model.data.discipline}`) ? t(`disciplines.${model.data.discipline}`) : model.data.discipline}</span>
        </div>
        {can("editModels") && <UploadButton modelId={modelId} label={t("list.uploadNew")} onUploaded={(v) => router.push(`${base}/versions/${v.id}`)} />}
      </div>
      <Table data-testid="versions-table">
        <TableHeader>
          <TableRow>
            <TableHead className="label-caps">{t("versions.number")}</TableHead>
            <TableHead className="label-caps">{t("versions.file")}</TableHead>
            <TableHead className="label-caps">{t("versions.uploaded")}</TableHead>
            <TableHead className="label-caps">{t("versions.by")}</TableHead>
            <TableHead className="label-caps">{t("versions.status")}</TableHead>
            <TableHead className="label-caps text-right">{t("versions.elements")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.data?.map((v) => (
            <TableRow key={v.id} data-testid={`version-row-${v.number}`}>
              <TableCell>
                <Link href={`${base}/versions/${v.id}`} className="hover:underline">
                  {t("versions.v", { number: v.number })}
                </Link>
              </TableCell>
              <TableCell>
                <span>{v.fileName}</span>
                {v.identicalToVersion && <span className="ml-2 text-muted-foreground">{t("versions.identical", { number: v.identicalToVersion })}</span>}
              </TableCell>
              <TableCell className="tabular-nums">{format.dateTime(new Date(v.uploadedAt), { dateStyle: "medium", timeStyle: "short" })}</TableCell>
              <TableCell>{v.uploadedBy?.name}</TableCell>
              <TableCell>
                <VersionStatus version={v} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{v.summary ? format.number(v.summary.elementCount) : null}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {can("editModels") && <ModelSettings key={model.data.name + model.data.discipline} modelId={modelId} name={model.data.name} discipline={model.data.discipline} />}
    </div>
  );
}

function ModelSettings({ modelId, name: initialName, discipline: initialDiscipline }: { modelId: string; name: string; discipline: string }) {
  const t = useTranslations("models");
  const message = useErrorMessage();
  const client = useQueryClient();
  const [name, setName] = useState(initialName);
  const [discipline, setDiscipline] = useState(initialDiscipline);
  const save = useMutation({
    mutationFn: async () => api.PATCH("/models/{modelId}", { params: { path: { modelId } }, body: { name: name.trim(), discipline } }),
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: ["model", modelId] }), client.invalidateQueries({ queryKey: ["models"] })]),
    onError: () => {},
  });
  const options = DISCIPLINES.includes(initialDiscipline) || initialDiscipline === "detect" ? DISCIPLINES : [...DISCIPLINES, initialDiscipline];
  return (
    <form
      className="flex max-w-2xl items-end gap-3 border-t border-border pt-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Field id="m-name" label={t("list.name")} className="flex-1" error={save.error ? message(save.error) : undefined}>
        <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field id="m-discipline" label={t("list.discipline")}>
        <NativeSelect id="m-discipline" value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
          {discipline === "detect" && <option value="detect">{t("disciplines.detect")}</option>}
          {options.map((d) => (
            <option key={d} value={d}>
              {t.has(`disciplines.${d}`) ? t(`disciplines.${d}`) : d}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Button type="submit" variant="outline" disabled={!name.trim() || save.isPending}>
        {t("versions.save")}
      </Button>
    </form>
  );
}
