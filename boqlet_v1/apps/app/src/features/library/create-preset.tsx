"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreatePreset, useLibraryPresets, usePresetVersion, usePresetVersions, type PresetKind } from "@/api/hooks/library";
import { useProject } from "@/api/hooks/projects";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOrg } from "@/features/orgs/org-context";
import { presetHref } from "./kinds";
import { hasTemplate, useDownloadTemplate } from "./template-tools";

type Mode = "empty" | "copy" | "patch";

/**
 * Create a preset (F10 §2): kind, name, start from empty, a copy of any version, or (rule sets) a
 * patch on one. `?mode=copy&from=<versionId>` comes from "Make a copy"; `?project=` makes a
 * project-layer preset. "Based on" is free text (BR-53): it names the user's own source, nothing more.
 * Import of a code list and Excel templates come with FE-023 and FE-026.
 */
export function CreatePreset({ kind }: { kind: PresetKind }) {
  const t = useTranslations("library");
  const message = useErrorMessage();
  const router = useRouter();
  const params = useSearchParams();
  const { org, can } = useOrg();
  const projectId = params.get("project") ?? undefined;
  const project = useProject(projectId ?? "", !!projectId);
  const fromParam = params.get("from") ?? undefined;
  const modeParam = params.get("mode");
  const fromVersion = usePresetVersion(fromParam);

  const [mode, setMode] = useState<Mode>(modeParam === "copy" || (modeParam === "patch" && kind === "rule_set") ? modeParam : "empty");
  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [basedOn, setBasedOn] = useState("");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);

  const sources = useLibraryPresets(org.id, projectId, { kind });
  const sourceList = (sources.data ?? []).filter((p) => p.latestPublishedVersion);
  const source = sourceId ?? fromVersion.data?.presetId ?? sourceList[0]?.id ?? "";
  const versions = usePresetVersions(mode === "empty" ? undefined : source || undefined);
  const published = (versions.data ?? []).filter((v) => v.status === "published");
  const sourcePreset = sourceList.find((p) => p.id === source);
  const version = versionId ?? (fromParam && fromVersion.data?.presetId === source ? fromParam : published[0]?.id) ?? "";
  // A copy from "Make a copy" is named after its source until the person types a name.
  const shownName = name ?? (fromParam && sourcePreset ? t("create.copyName", { name: sourcePreset.name }) : "");

  const allowed = projectId ? project.data?.permissions?.editPresets === true && project.data.status !== "archived" : can("editLibrary");
  const create = useCreatePreset(org.id);
  const download = useDownloadTemplate();
  // An empty template is the kind's master preset's layout with nothing filled in (F10 §14).
  const templateOf = sourceList.find((p) => p.layer === "system" && (kind !== "rule_set" || p.slug === "as-modelled")) ?? sourceList[0];
  const back = projectId ? `/${org.slug}/projects/${projectId}/library` : `/${org.slug}/library${kind === "rule_set" ? "" : `?kind=${kind}`}`;

  if (projectId && project.isPending) return <div aria-busy="true" />;
  if (!allowed) return <p className="text-muted-foreground">{t("create.notAllowed")}</p>;

  const canSubmit = shownName.trim() && (mode === "empty" || version) && !create.isPending;
  return (
    <form
      className="flex max-w-xl flex-col gap-5"
      data-testid="create-preset"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        create.mutate(
          {
            kind,
            name: shownName.trim(),
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(basedOn.trim() ? { basedOn: basedOn.trim() } : {}),
            ...(projectId ? { projectId } : {}),
            start: { mode, ...(mode === "empty" ? {} : { fromVersionId: version }) },
          },
          // New rule sets and classifications open in guided mode (F10 §2, P24).
          { onSuccess: (preset) => router.push(`${presetHref(org.slug, preset)}${preset.kind === "rule_set" || preset.kind === "classification" ? "?mode=guided" : ""}`) },
        );
      }}
    >
      {kind === "rule_set" && <LicenceNotice />}
      <div className="flex flex-col gap-1">
        <h1 className="text-title">{t(`create.title.${kind}`)}</h1>
        {project.data && <p className="text-muted-foreground">{t("create.forProject", { project: project.data.name })}</p>}
      </div>
      <Field id="preset-name" label={t("create.name")} error={create.error ? message(create.error) : undefined}>
        <Input id="preset-name" value={shownName} onChange={(e) => setName(e.target.value)} autoFocus data-testid="preset-name-input" />
      </Field>
      <Field id="preset-description" label={`${t("create.description")} (${t("create.optional")})`}>
        <Input id="preset-description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field id="preset-based-on" label={`${t("create.basedOn")} (${t("create.optional")})`} hint={t("create.basedOnHint")}>
        <Input id="preset-based-on" value={basedOn} onChange={(e) => setBasedOn(e.target.value)} />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="label-caps mb-1.5 text-muted-foreground">{t("create.start")}</legend>
        {(["empty", "copy", ...(kind === "rule_set" ? (["patch"] as const) : [])] as Mode[]).map((m) => (
          <label key={m} className="flex items-start gap-2">
            <input type="radio" name="start" value={m} checked={mode === m} onChange={() => setMode(m)} className="mt-1" data-testid={`start-${m}`} />
            <span className="flex flex-col">
              <span>{t(`create.modes.${m}`)}</span>
              <span className="text-muted-foreground">{t(`create.modeHints.${m}`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {mode !== "empty" && (
        <div className="flex flex-wrap gap-3">
          <Field id="preset-source" label={t(mode === "patch" ? "create.patchOn" : "create.copyOf")} className="min-w-64 flex-1">
            <NativeSelect
              id="preset-source"
              value={source}
              onChange={(e) => {
                setSourceId(e.target.value);
                setVersionId(null);
              }}
              data-testid="preset-source"
            >
              {sourceList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {t(`layers.${p.layer}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="preset-version" label={t("create.version")}>
            <NativeSelect id="preset-version" value={version} onChange={(e) => setVersionId(e.target.value)} data-testid="preset-version">
              {published.map((v) => (
                <option key={v.id} value={v.id}>
                  {t("preset.versionN", { n: v.number ?? 0 })}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      )}
      <div className="flex gap-3">
        <Button type="submit" disabled={!canSubmit} data-testid="create-preset-submit">
          {t("create.submit")}
        </Button>
        <Button variant="outline" render={<Link href={back} />} nativeButton={false}>
          {t("create.cancel")}
        </Button>
        {hasTemplate(kind) && templateOf && (
          <Button type="button" variant="ghost" onClick={() => download.mutate({ preset: templateOf, source: "empty" })} disabled={download.isPending} data-testid="empty-template">
            {t("template.emptyTemplate")}
          </Button>
        )}
      </div>
    </form>
  );
}

const LICENCE_KEY = "boqlet-licence-notice";

/** F10 §12 (BR-53, D30–D31): once, before the first rule set, what "bring your own licence" means. */
function LicenceNotice() {
  const t = useTranslations("library.create");
  const [seen, setSeen] = useState(() => {
    try {
      return window.localStorage.getItem(LICENCE_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (seen) return null;
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-muted p-3" role="note" data-testid="licence-notice">
      <p className="label-caps">{t("licenceTitle")}</p>
      <p>{t("licence")}</p>
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => {
          setSeen(true);
          try {
            window.localStorage.setItem(LICENCE_KEY, "1");
          } catch {
            /* storage blocked */
          }
        }}
        data-testid="licence-ok"
      >
        {t("licenceOk")}
      </Button>
    </div>
  );
}
