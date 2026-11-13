"use client";

import { useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { useLibraryPresets, usePreset, type Preset } from "@/api/hooks/library";
import { useOrgSetup, useSaveOrgSetup, type OrgSetup } from "@/api/hooks/setup";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EditorProps } from "@/features/library/preset-editor";
import { ModelVersionPicker, type PickedModelVersion } from "@/features/library/preview/model-version-picker";
import { PreviewResultContext } from "@/features/library/preview/preview-context";
import { PreviewPanel } from "@/features/library/preview/preview-panel";
import { useDraft, type Draft } from "@/features/library/shared/use-draft";
import { useOrg } from "@/features/orgs/org-context";
import { cn } from "@/lib/utils";
import type { PreviewResult } from "@/api/hooks/library";
import { MeasureStep } from "./measure-step";
import { ReviewStep } from "./review-step";

type Step = OrgSetup["step"];
const STEPS: Step[] = ["start", "measure", "items", "names", "review"];

const loading = () => <div aria-busy="true" className="h-40" />;
type AnyEditor = ComponentType<EditorProps>;
const ClassificationEditor = dynamic(() => import("@/features/library/classification/classification-editor").then((m) => m.ClassificationEditor as unknown as AnyEditor), { loading });
const DictionaryEditor = dynamic(() => import("@/features/library/dictionary/dictionary-editor").then((m) => m.DictionaryEditor as unknown as AnyEditor), { loading });

/**
 * S30 `/{org}/setup` (F16): the setup wizard. A step list on the left, the step in the middle and the
 * preview on the right. It creates (or continues) a rule-set patch, a classification and a company
 * dictionary as ordinary Library drafts; progress is kept in `Org.setup`, so leaving and coming back
 * opens the step where the person left.
 */
export function SetupWizard() {
  const t = useTranslations("setup");
  const { org, can } = useOrg();
  const setup = useOrgSetup(org.id);
  const save = useSaveOrgSetup(org.id);
  const [restart, setRestart] = useState(false);
  if (!can("finishSetup")) return <p className="text-muted-foreground">{t("notAllowed")}</p>;
  if (setup.isPending) return loading();
  const current = setup.data;
  const started = current && current.ruleSetPresetId && !restart;
  if (current?.status === "done" && !restart) {
    return (
      <div className="flex max-w-2xl flex-col gap-4" data-testid="setup-done">
        <h1 className="text-title">{t("title")}</h1>
        <p>{t("doneAlready")}</p>
        <div className="flex gap-2">
          <Button onClick={() => setRestart(true)} data-testid="setup-again">
            {t("runAgain")}
          </Button>
          <Button variant="outline" render={<Link href={`/${org.slug}/library`} />} nativeButton={false}>
            {t("toLibrary")}
          </Button>
        </div>
      </div>
    );
  }
  if (!started) {
    return (
      <StartStep
        onStarted={async (ids, modelVersionId) => {
          await save.mutateAsync({ status: "in_progress", step: "measure", ...ids, modelVersionId });
          setRestart(false);
        }}
      />
    );
  }
  return <Wizard setup={current!} onStep={(step) => save.mutate({ step })} />;
}

function Wizard({ setup, onStep }: { setup: OrgSetup; onStep: (step: Step) => void }) {
  const t = useTranslations("setup");
  const { org } = useOrg();
  const step: Step = setup.step === "start" ? "measure" : setup.step;
  const [screen, setScreen] = useState(0);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const rules = usePreset(setup.ruleSetPresetId!);
  const items = usePreset(setup.classificationPresetId!);
  const names = usePreset(setup.dictionaryPresetId!);
  const model = useModelOf(setup.modelVersionId ?? null);
  if (!rules.data || !items.data || !names.data) return loading();
  const go = (s: Step) => {
    setScreen(0);
    onStep(s);
  };
  return (
    <div className="flex flex-col gap-6" data-testid="setup-wizard" data-step={step}>
      <div className="flex flex-col gap-1">
        <h1 className="text-title">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav aria-label={t("steps")} className="flex flex-row flex-wrap gap-2 xl:flex-col">
          {STEPS.filter((s) => s !== "start").map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => go(s)}
              aria-current={s === step ? "step" : undefined}
              className={cn("rounded-[var(--radius)] px-2 py-1 text-left hover:bg-muted", s === step && "bg-selection")}
              data-testid={`setup-step-${s}`}
            >
              <span className="label-caps mr-2 text-muted-foreground tabular-nums">{i + 1}</span>
              {t(`stepNames.${s}`)}
            </button>
          ))}
        </nav>
        <PreviewResultContext.Provider value={previewResult}>
          <div className="min-w-0">
            {step === "measure" && <DraftStep key={rules.data.id} preset={rules.data} render={(draft) => <MeasureStep preset={rules.data!} draft={draft} orgSlug={org.slug} screenIndex={screen} onScreen={setScreen} onDone={() => go("items")} />} preview={model} otherInputs={null} onResult={setPreviewResult} />}
            {step === "items" && (
              <DraftStep
                key={items.data.id}
                preset={items.data}
                preview={model}
                otherInputs={{ ruleSetVersionId: rules.data.draft?.id ?? rules.data.latestPublishedVersion?.id }}
                onResult={setPreviewResult}
                render={(draft) => (
                  <EditorStep title={t("items.title")} intro={t("items.intro")} next={t("items.next")} skip={t("items.skip")} onNext={() => go("names")} draft={draft}>
                    <ClassificationEditor preset={items.data!} doc={draft.doc} onChange={(d) => draft.setDoc(d)} parent={null} />
                  </EditorStep>
                )}
              />
            )}
            {step === "names" && (
              <DraftStep
                key={names.data.id}
                preset={names.data}
                preview={model}
                otherInputs={{ ruleSetVersionId: rules.data.draft?.id ?? rules.data.latestPublishedVersion?.id, ...(items.data.draft || items.data.latestPublishedVersion ? { classificationVersionIds: [(items.data.draft ?? items.data.latestPublishedVersion)!.id] } : {}) }}
                onResult={setPreviewResult}
                render={(draft) => (
                  <EditorStep title={t("names.title")} intro={t(model ? "names.intro" : "names.noModel")} next={t("names.next")} skip={t("names.skip")} onNext={() => go("review")} draft={draft}>
                    <DictionaryEditor preset={names.data!} doc={draft.doc} onChange={(d) => draft.setDoc(d)} parent={null} />
                  </EditorStep>
                )}
              />
            )}
            {step === "review" && <ReviewStep rules={rules.data} items={items.data} names={names.data} modelProjectId={model?.projectId ?? null} onEdit={go} />}
          </div>
        </PreviewResultContext.Provider>
      </div>
    </div>
  );
}

/** The draft of a step's preset, with its preview, rendered by the step. */
function DraftStep({ preset, render, preview, otherInputs, onResult }: {
  preset: Preset;
  render: (draft: Draft<unknown>) => React.ReactNode;
  preview: PickedModelVersion | null;
  otherInputs: Record<string, unknown> | null;
  onResult: (r: PreviewResult | null) => void;
}) {
  const t = useTranslations("setup");
  const draft = useDraft<unknown>(preset);
  if (draft.doc === undefined) return loading();
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(300px,2fr)]">
      <div className="min-w-0">{render(draft)}</div>
      {preview ? (
        <PreviewPanel preset={preset} saves={draft.saves} fixed={preview} otherInputs={otherInputs ?? undefined} onResult={onResult} />
      ) : (
        <aside className="text-muted-foreground" data-testid="setup-no-model">
          {t("noModel")}
        </aside>
      )}
    </div>
  );
}

function EditorStep({ title, intro, next, skip, onNext, draft, children }: { title: string; intro: string; next: string; skip: string; onNext: () => void; draft: Draft<unknown>; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-title">{title}</h2>
        <p className="text-muted-foreground">{intro}</p>
      </div>
      {draft.problems.length > 0 && (
        <ul className="list-disc rounded-[var(--radius)] border border-error p-3 pl-6" role="status">
          {draft.problems.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
      {children}
      <div className="flex gap-2 border-t border-border pt-4">
        <Button
          onClick={async () => {
            await draft.flush();
            onNext();
          }}
          data-testid="setup-next"
        >
          {next}
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            await draft.flush();
            onNext();
          }}
          data-testid="setup-skip"
        >
          {skip}
        </Button>
      </div>
    </div>
  );
}

/** The project and model of a model version (the wizard keeps only the version's id in `Org.setup`). */
function useModelOf(versionId: string | null): PickedModelVersion | null {
  const q = useQuery({
    queryKey: ["setupModel", versionId],
    enabled: !!versionId,
    staleTime: Infinity,
    queryFn: async () => {
      const version = (await api.GET("/model-versions/{versionId}", { params: { path: { versionId: versionId! } } })).data!;
      const model = (await api.GET("/models/{modelId}", { params: { path: { modelId: version.modelId } } })).data!;
      return { projectId: model.projectId, modelId: model.id, versionId: version.id } satisfies PickedModelVersion;
    },
  });
  return q.data ?? null;
}

/**
 * Step 0 (F16 "Start"): the model to try it on (optional), the rule set to start from, and the names of
 * the three drafts. A kind the org already has is continued in a new draft of that preset (no `402` on a
 * free plan); otherwise the wizard creates it.
 */
function StartStep({ onStarted }: { onStarted: (ids: { ruleSetPresetId: string; classificationPresetId: string; dictionaryPresetId: string }, modelVersionId: string | null) => Promise<void> }) {
  const t = useTranslations("setup.start");
  const message = useErrorMessage();
  const { org } = useOrg();
  const presets = useLibraryPresets(org.id, undefined, { kind: "rule_set" });
  const own = useLibraryPresets(org.id, undefined, { layer: "org" });
  const [model, setModel] = useState<PickedModelVersion | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [names, setNames] = useState({ rules: t("defaultRules", { org: org.name }), items: t("defaultItems", { org: org.name }), dict: t("defaultNames", { org: org.name }) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const ruleSets = (presets.data ?? []).filter((p) => p.latestPublishedVersion);
  const startFrom = from ?? ruleSets.find((p) => p.slug === "as-modelled" && p.layer === "system")?.latestPublishedVersion?.id ?? ruleSets[0]?.latestPublishedVersion?.id ?? "";
  const existing = (kind: Preset["kind"]) => (own.data ?? []).find((p) => p.kind === kind && !p.archived);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const make = async (kind: Preset["kind"], name: string, body: Schemas["PresetCreate"]["start"]) => {
        const found = existing(kind);
        if (found) return found.id;
        return (await api.POST("/orgs/{orgId}/presets", { params: { path: { orgId: org.id } }, body: { kind, name, start: body } })).data!.id;
      };
      const ruleSetPresetId = await make("rule_set", names.rules.trim(), { mode: "patch", fromVersionId: startFrom });
      const classificationPresetId = await make("classification", names.items.trim(), { mode: "empty" });
      const dictionaryPresetId = await make("dictionary", names.dict.trim(), { mode: "empty" });
      await onStarted({ ruleSetPresetId, classificationPresetId, dictionaryPresetId }, model?.versionId ?? null);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const ready = !!startFrom && names.rules.trim() && names.items.trim() && names.dict.trim();
  return (
    <div className="flex max-w-2xl flex-col gap-5" data-testid="setup-start">
      <div className="flex flex-col gap-1">
        <h1 className="text-title">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="label-caps text-muted-foreground">{t("model")}</span>
        <ModelVersionPicker value={model} onChange={setModel} />
        <span className="text-muted-foreground">{t("modelHint")}</span>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="label-caps mb-1.5 text-muted-foreground">{t("startFrom")}</legend>
        {ruleSets.map((p) => (
          <label key={p.id} className="flex items-start gap-2">
            <input type="radio" name="setup-from" className="mt-1" checked={startFrom === p.latestPublishedVersion!.id} onChange={() => setFrom(p.latestPublishedVersion!.id)} data-testid="setup-from" data-slug={p.slug} />
            <span className="flex flex-col">
              <span>{p.name}</span>
              {p.basedOn && <span className="text-muted-foreground">{t("basedOn", { text: p.basedOn })}</span>}
            </span>
          </label>
        ))}
      </fieldset>
      {(["rules", "items", "dict"] as const).map((k) => {
        const kind = k === "rules" ? "rule_set" : k === "items" ? "classification" : "dictionary";
        const found = existing(kind);
        return found ? (
          <p key={k} className="text-muted-foreground" data-testid={`setup-continue-${kind}`}>
            {t("continue", { name: found.name })}
          </p>
        ) : (
          <Field key={k} id={`setup-name-${k}`} label={t(`names.${k}`)}>
            <Input id={`setup-name-${k}`} value={names[k]} onChange={(e) => setNames({ ...names, [k]: e.target.value })} data-testid={`setup-name-${k}`} />
          </Field>
        );
      })}
      {!!error && (
        <p role="alert" className="text-error">
          {message(error)}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={start} disabled={!ready || busy} data-testid="setup-start-go">
          {busy ? t("starting") : t("go")}
        </Button>
      </div>
    </div>
  );
}
