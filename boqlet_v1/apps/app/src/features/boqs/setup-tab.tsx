"use client";

import { useQueries } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import { usePresetCatalogue, useUpdateInputs, type Boq, type Preset, type PresetKind, type RevisionInputs } from "@/api/hooks/boqs";
import { useModels } from "@/api/hooks/models";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DISCIPLINES = ["architecture", "structure", "mep"];

/**
 * S12f Setup (F04 §2): the working version's inputs. Every change is saved at once; the header then
 * shows "Inputs changed since this run". Read-only outside the working version or without the role.
 */
export function SetupTab({ boq, orgId }: { boq: Boq; orgId: string }) {
  const t = useTranslations("boqs.setup");
  const message = useErrorMessage();
  const revision = boq.currentRevision;
  const inputs = revision.inputs;
  const editable = revision.permissions.editBoqs === true;
  const update = useUpdateInputs(revision.id, boq.id);
  const catalogue = usePresetCatalogue(orgId, boq.projectId);
  const change = (patch: Partial<RevisionInputs>) => update.mutate(patch);

  return (
    <div className="flex flex-col gap-10" data-testid="setup-tab" aria-busy={update.isPending}>
      {!editable && <p className="text-muted-foreground">{t("readOnly")}</p>}
      {update.error ? (
        <p role="alert" className="text-error">
          {message(update.error)}
        </p>
      ) : null}
      <ModelsSection boq={boq} editable={editable} onChange={change} />
      <RuleSetSection inputs={inputs} catalogue={catalogue} editable={editable} onChange={change} />
      <OrderedPresets
        kind="classification"
        title={t("classifications")}
        hint={t("classificationsHint")}
        chosen={inputs.classificationVersionIds}
        catalogue={catalogue}
        editable={editable}
        onChange={(ids) => change({ classificationVersionIds: ids })}
      />
      <OrderedPresets
        kind="dictionary"
        title={t("dictionaries")}
        hint={t("dictionariesHint")}
        chosen={inputs.dictionaryVersionIds}
        catalogue={catalogue}
        editable={editable}
        onChange={(ids) => change({ dictionaryVersionIds: ids })}
        fixedLast={catalogue.list.find((p) => p.kind === "dictionary" && p.layer === "project")}
      />
      <details className="flex flex-col gap-4" data-testid="setup-advanced">
        <summary className="label-caps cursor-pointer">{t("advanced")}</summary>
        <div className="mt-4 flex max-w-2xl flex-col gap-4">
          <SinglePreset kind="federation" label={t("federation")} value={inputs.federationVersionId ?? null} catalogue={catalogue} editable={editable} onChange={(id) => change({ federationVersionId: id })} />
          <SinglePreset kind="resolution" label={t("resolution")} value={inputs.resolutionVersionId ?? null} catalogue={catalogue} editable={editable} onChange={(id) => change({ resolutionVersionId: id })} />
        </div>
      </details>
    </div>
  );
}

type Catalogue = ReturnType<typeof usePresetCatalogue>;

function Section({ title, hint, children, testId }: { title: string; hint?: string; children: React.ReactNode; testId: string }) {
  return (
    <section className="flex flex-col gap-3" data-testid={testId}>
      <div className="flex flex-col gap-1">
        <h3 className="label-caps">{title}</h3>
        {hint && <p className="text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function ModelsSection({ boq, editable, onChange }: { boq: Boq; editable: boolean; onChange: (patch: Partial<RevisionInputs>) => void }) {
  const t = useTranslations("boqs.setup");
  const tm = useTranslations("models");
  const models = useModels(boq.projectId);
  const list = models.data ?? [];
  const versions = useQueries({
    queries: list.map((m) => ({
      queryKey: keys.modelVersions(m.id),
      queryFn: async () => (await api.GET("/models/{modelId}/versions", { params: { path: { modelId: m.id } } })).data!,
    })),
  });
  const chosen = boq.currentRevision.inputs.models;
  const setModels = (next: RevisionInputs["models"]) => onChange({ models: next.map((m) => ({ modelId: m.modelId, modelVersionId: m.modelVersionId, discipline: m.discipline, ...(m.scope ? { scope: m.scope } : {}) })) });

  return (
    <Section title={t("models")} testId="setup-models">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="label-caps w-12">{t("use")}</TableHead>
            <TableHead className="label-caps">{t("model")}</TableHead>
            <TableHead className="label-caps">{t("version")}</TableHead>
            <TableHead className="label-caps">{t("discipline")}</TableHead>
            <TableHead className="label-caps">{t("scope")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((m, i) => {
            const ready = (versions[i]?.data ?? []).filter((v) => v.status === "ready");
            const input = chosen.find((c) => c.modelId === m.id);
            const latest = ready[0];
            const discipline = input?.discipline ?? m.discipline;
            return (
              <TableRow key={m.id} data-testid={`setup-model-${m.name}`}>
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={m.name}
                    checked={!!input}
                    disabled={!editable || (!input && !latest)}
                    onChange={(e) =>
                      setModels(e.target.checked ? [...chosen, { modelId: m.id, modelVersionId: latest!.id, discipline: m.discipline }] : chosen.filter((c) => c.modelId !== m.id))
                    }
                    data-testid={`use-model-${m.name}`}
                  />
                </TableCell>
                <TableCell>{m.name}</TableCell>
                <TableCell>
                  {ready.length === 0 ? (
                    <span className="text-muted-foreground">{t("noReadyVersion")}</span>
                  ) : (
                    <div className="flex items-center gap-3">
                      <NativeSelect
                        aria-label={t("version")}
                        value={input?.modelVersionId ?? latest!.id}
                        disabled={!editable || !input}
                        onChange={(e) => setModels(chosen.map((c) => (c.modelId === m.id ? { ...c, modelVersionId: e.target.value } : c)))}
                        data-testid={`model-version-${m.name}`}
                      >
                        {ready.map((v) => (
                          <option key={v.id} value={v.id}>
                            {t("versionOption", { number: v.number, file: v.fileName })}
                          </option>
                        ))}
                      </NativeSelect>
                      {input?.newerVersionAvailable ? (
                        editable ? (
                          <Button variant="outline" onClick={() => setModels(chosen.map((c) => (c.modelId === m.id ? { ...c, modelVersionId: latest!.id } : c)))} data-testid={`use-newer-${m.name}`}>
                            {t("useNewer", { number: input.newerVersionAvailable })}
                          </Button>
                        ) : (
                          <span className="label-caps">{t("newer", { number: input.newerVersionAvailable })}</span>
                        )
                      ) : null}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <NativeSelect
                    aria-label={t("discipline")}
                    value={discipline}
                    disabled={!editable || !input}
                    onChange={(e) => setModels(chosen.map((c) => (c.modelId === m.id ? { ...c, discipline: e.target.value } : c)))}
                  >
                    {(DISCIPLINES.includes(discipline) ? DISCIPLINES : [...DISCIPLINES, discipline]).map((d) => (
                      <option key={d} value={d}>
                        {tm.has(`disciplines.${d}`) ? tm(`disciplines.${d}`) : d}
                      </option>
                    ))}
                  </NativeSelect>
                </TableCell>
                <TableCell className="text-muted-foreground">{scopeSummary(input?.scope ?? m.scope, t)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Section>
  );
}

/** "Whole model" or the number of scope rules (scope editing per BoQ comes with the Library selectors). */
function scopeSummary(scope: unknown, t: ReturnType<typeof useTranslations>) {
  const s = (scope ?? {}) as Record<string, unknown>;
  const count = Object.values(s).reduce<number>((n, v) => n + (Array.isArray(v) ? v.length : v ? 1 : 0), 0);
  return count ? t("scopeRules", { count }) : t("wholeModel");
}

const presetLabel = (p: Preset, t: ReturnType<typeof useTranslations>) => `${p.name} · ${t(`layers.${p.layer}`)}`;

function RuleSetSection({ inputs, catalogue, editable, onChange }: { inputs: RevisionInputs; catalogue: Catalogue; editable: boolean; onChange: (patch: Partial<RevisionInputs>) => void }) {
  const t = useTranslations("boqs.setup");
  const ruleSets = catalogue.list.filter((p) => p.kind === "rule_set" && p.latestPublishedVersion);
  const current = catalogue.byVersion.get(inputs.ruleSetVersionId);
  const versions = current ? catalogue.versionsOf(current.preset.id) : [];
  const latestId = current?.preset.latestPublishedVersion?.id;
  const base = current?.preset.basedOn ? catalogue.list.find((p) => p.kind === "rule_set" && p.slug === current.preset.basedOn) : undefined;
  return (
    <Section title={t("ruleSet")} testId="setup-rule-set">
      <div className="flex max-w-2xl flex-wrap items-center gap-3">
        <NativeSelect
          aria-label={t("ruleSet")}
          className="min-w-64"
          value={current?.preset.id ?? ""}
          disabled={!editable}
          onChange={(e) => {
            const preset = ruleSets.find((p) => p.id === e.target.value);
            if (preset) onChange({ ruleSetVersionId: preset.latestPublishedVersion!.id });
          }}
          data-testid="rule-set-select"
        >
          {!current && <option value="">{t("none")}</option>}
          {ruleSets.map((p) => (
            <option key={p.id} value={p.id}>
              {presetLabel(p, t)}
            </option>
          ))}
        </NativeSelect>
        {current && (
          <NativeSelect aria-label={t("version")} value={inputs.ruleSetVersionId} disabled={!editable} onChange={(e) => onChange({ ruleSetVersionId: e.target.value })} data-testid="rule-set-version">
            {(versions.length ? versions : [current.version]).map((v) => (
              <option key={v.id} value={v.id}>
                {v.id === latestId ? t("versionLatest", { number: v.number ?? 0 }) : t("versionPinned", { number: v.number ?? 0 })}
              </option>
            ))}
          </NativeSelect>
        )}
      </div>
      {current && (
        <div className="flex max-w-[72ch] flex-col gap-1 text-prose">
          {current.preset.basedOn && <p className="text-muted-foreground">{t("basedOn", { name: base?.name ?? current.preset.basedOn })}</p>}
          {current.preset.description && <p>{current.preset.description}</p>}
        </div>
      )}
    </Section>
  );
}

function OrderedPresets({
  kind,
  title,
  hint,
  chosen,
  catalogue,
  editable,
  onChange,
  fixedLast,
}: {
  kind: PresetKind;
  title: string;
  hint: string;
  chosen: string[];
  catalogue: Catalogue;
  editable: boolean;
  onChange: (ids: string[]) => void;
  fixedLast?: Preset;
}) {
  const t = useTranslations("boqs.setup");
  const chosenPresets = new Set(chosen.map((id) => catalogue.byVersion.get(id)?.preset.id));
  const addable = catalogue.list.filter((p) => p.kind === kind && p.layer !== "project" && p.latestPublishedVersion && !chosenPresets.has(p.id));
  const move = (i: number, by: number) => {
    const next = [...chosen];
    [next[i], next[i + by]] = [next[i + by]!, next[i]!];
    onChange(next);
  };
  return (
    <Section title={title} hint={hint} testId={`setup-${kind}`}>
      <ol className="flex max-w-2xl flex-col divide-y divide-border border-y border-border">
        {chosen.map((id, i) => {
          const entry = catalogue.byVersion.get(id);
          return (
            <li key={id} className="flex items-center gap-3 py-2" data-testid={`chosen-${kind}`}>
              <span className="w-6 text-right tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="flex-1">
                {entry ? presetLabel(entry.preset, t) : id}
                {entry?.version.number ? <span className="ml-2 text-muted-foreground">{t("versionPinned", { number: entry.version.number })}</span> : null}
              </span>
              {editable && (
                <span className="flex gap-1">
                  <Button variant="ghost" aria-label={t("moveUp")} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button variant="ghost" aria-label={t("moveDown")} disabled={i === chosen.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button variant="ghost" onClick={() => onChange(chosen.filter((x) => x !== id))} data-testid={`remove-${kind}`}>
                    {t("remove")}
                  </Button>
                </span>
              )}
            </li>
          );
        })}
        {fixedLast && (
          <li className="flex items-center gap-3 py-2 text-muted-foreground" data-testid="project-dictionary">
            <span className="w-6 text-right tabular-nums">{chosen.length + 1}</span>
            <span className="flex-1">{presetLabel(fixedLast, t)}</span>
            <span className="label-caps">{t("fixed")}</span>
          </li>
        )}
      </ol>
      {editable && addable.length > 0 && (
        <NativeSelect
          aria-label={`${title}: ${t("add")}`}
          className="max-w-sm"
          value=""
          onChange={(e) => {
            const preset = addable.find((p) => p.id === e.target.value);
            if (preset && preset.available !== false) onChange([...chosen, preset.latestPublishedVersion!.id]);
          }}
          data-testid={`add-${kind}`}
        >
          <option value="">{t("add")}</option>
          {addable.map((p) => (
            <option key={p.id} value={p.id} disabled={p.available === false}>
              {p.available === false ? t("unavailable", { name: p.name }) : presetLabel(p, t)}
            </option>
          ))}
        </NativeSelect>
      )}
    </Section>
  );
}

function SinglePreset({
  kind,
  label,
  value,
  catalogue,
  editable,
  onChange,
}: {
  kind: PresetKind;
  label: string;
  value: string | null;
  catalogue: Catalogue;
  editable: boolean;
  onChange: (id: string | null) => void;
}) {
  const t = useTranslations("boqs.setup");
  const options = catalogue.list.filter((p) => p.kind === kind && p.latestPublishedVersion);
  const current = value ? catalogue.byVersion.get(value) : undefined;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-caps text-muted-foreground">{label}</span>
      <NativeSelect
        value={current?.preset.id ?? ""}
        disabled={!editable}
        onChange={(e) => {
          const preset = options.find((p) => p.id === e.target.value);
          onChange(preset ? preset.latestPublishedVersion!.id : null);
        }}
      >
        <option value="">{t("orgDefault")}</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {presetLabel(p, t)}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
