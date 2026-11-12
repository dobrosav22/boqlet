"use client";

import { useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import { usePresets } from "@/api/hooks/boqs";
import { useModels } from "@/api/hooks/models";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Schemas } from "@ifc-boq/api";

/**
 * New BoQ (F04 §1): name, description, which models go in (latest ready versions ticked), and the
 * rule set and classifications, preselected from the project's defaults. `fromModel` is the
 * "Generate a BoQ" path from a ready model version: only that model ticked, and the first run starts
 * right after creating.
 */
export function CreateBoqDialog({
  orgSlug,
  orgId,
  project,
  open,
  onOpenChange,
  fromModel,
}: {
  orgSlug: string;
  orgId: string;
  project: Schemas["Project"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromModel?: { modelId: string; versionId: string };
}) {
  const t = useTranslations("boqs.create");
  const ts = useTranslations("boqs.setup");
  const message = useErrorMessage();
  const router = useRouter();
  const client = useQueryClient();
  const models = useModels(project.id);
  const presets = usePresets(orgId, project.id);
  const list = models.data ?? [];
  const versions = useQueries({
    queries: list.map((m) => ({
      queryKey: keys.modelVersions(m.id),
      queryFn: async () => (await api.GET("/models/{modelId}/versions", { params: { path: { modelId: m.id } } })).data!,
      enabled: open,
    })),
  });
  const readyVersion = (modelId: string) => {
    const i = list.findIndex((m) => m.id === modelId);
    if (fromModel?.modelId === modelId) return fromModel.versionId;
    return (versions[i]?.data ?? []).find((v) => v.status === "ready")?.id;
  };
  const candidates = list.filter((m) => readyVersion(m.id));

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // null = "as the defaults say" until the person changes it.
  const [ticked, setTicked] = useState<Set<string> | null>(null);
  const [ruleSetVersionId, setRuleSetVersionId] = useState<string | null>(null);
  const [classificationIds, setClassificationIds] = useState<string[] | null>(null);

  const chosenModels = ticked ?? new Set(fromModel ? [fromModel.modelId] : candidates.map((m) => m.id));
  const ruleSets = (presets.data ?? []).filter((p) => p.kind === "rule_set" && p.latestPublishedVersion);
  const classifications = (presets.data ?? []).filter((p) => p.kind === "classification" && p.latestPublishedVersion);
  const ruleSet = ruleSetVersionId ?? project.defaults.ruleSetVersionId ?? "";
  const codeLists = classificationIds ?? project.defaults.classificationVersionIds ?? [];

  const create = useMutation({
    mutationFn: async () => {
      const inputs = {
        models: candidates
          .filter((m) => chosenModels.has(m.id))
          .map((m) => ({ modelId: m.id, modelVersionId: readyVersion(m.id)!, discipline: m.discipline })),
        ...(ruleSet ? { ruleSetVersionId: ruleSet } : {}),
        classificationVersionIds: codeLists,
      };
      const boq = (await api.POST("/projects/{projectId}/boqs", { params: { path: { projectId: project.id } }, body: { name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}), inputs } })).data!;
      if (fromModel) await api.POST("/revisions/{revisionId}/runs", { params: { path: { revisionId: boq.currentRevision.id } } });
      return boq;
    },
    onSuccess: async (boq) => {
      await client.invalidateQueries({ queryKey: keys.boqs(project.id) });
      onOpenChange(false);
      router.push(`/${orgSlug}/projects/${project.id}/boqs/${boq.id}${fromModel ? "" : "?tab=setup"}`);
    },
    onError: () => {},
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="create-boq-dialog" className="sm:max-w-xl">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{fromModel ? t("fromModelTitle") : t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <Field id="boq-name" label={t("name")} error={create.error ? message(create.error) : undefined}>
            <Input id="boq-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} autoFocus data-testid="boq-name" />
          </Field>
          <Field id="boq-description" label={`${t("notes")} (${t("optional")})`}>
            <Input id="boq-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="label-caps mb-1.5 text-muted-foreground">{t("models")}</legend>
            {candidates.length === 0 && <p className="text-muted-foreground">{t("noReadyModels")}</p>}
            {candidates.map((m) => (
              <label key={m.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={chosenModels.has(m.id)}
                  onChange={(e) => {
                    const next = new Set(chosenModels);
                    if (e.target.checked) next.add(m.id);
                    else next.delete(m.id);
                    setTicked(next);
                  }}
                  data-testid={`create-model-${m.name}`}
                />
                {m.name}
              </label>
            ))}
          </fieldset>
          <Field id="boq-rule-set" label={t("ruleSet")}>
            <NativeSelect id="boq-rule-set" value={ruleSets.find((p) => p.latestPublishedVersion!.id === ruleSet)?.id ?? ""} onChange={(e) => setRuleSetVersionId(ruleSets.find((p) => p.id === e.target.value)?.latestPublishedVersion!.id ?? null)}>
              {!ruleSets.some((p) => p.latestPublishedVersion!.id === ruleSet) && <option value="">{ruleSet ? t("projectDefault") : ts("none")}</option>}
              {ruleSets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {ts(`layers.${p.layer}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="label-caps mb-1.5 text-muted-foreground">{t("classifications")}</legend>
            {classifications.map((p) => {
              const id = p.latestPublishedVersion!.id;
              return (
                <label key={p.id} className="flex items-center gap-2" title={p.available === false ? ts("unavailable", { name: p.name }) : undefined}>
                  <input
                    type="checkbox"
                    disabled={p.available === false}
                    checked={codeLists.includes(id)}
                    onChange={(e) => setClassificationIds(e.target.checked ? [...codeLists, id] : codeLists.filter((x) => x !== id))}
                  />
                  <span className={p.available === false ? "text-muted-foreground" : undefined}>{p.available === false ? ts("unavailable", { name: p.name }) : p.name}</span>
                </label>
              );
            })}
          </fieldset>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>{t("cancel")}</DialogClose>
            <Button type="submit" disabled={!name.trim() || create.isPending} data-testid="create-boq-submit">
              {fromModel ? t("createAndGenerate") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
