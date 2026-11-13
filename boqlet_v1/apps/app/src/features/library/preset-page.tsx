"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useArchivePreset, useDiscardDraft, usePreset, useUpdatePreset, type Preset, type PreviewResult } from "@/api/hooks/library";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useOrg } from "@/features/orgs/org-context";
import { useRelativeTime } from "@/i18n/use-relative-time";
import { cn } from "@/lib/utils";
import { Tag } from "./kinds";
import { CloneDialog } from "./clone-dialog";
import { MeasureStep } from "@/features/setup/measure-step";
import { PresetEditor } from "./preset-editor";
import { TemplateTools } from "./template-tools";
import { PreviewResultContext } from "./preview/preview-context";
import { PreviewPanel } from "./preview/preview-panel";
import { PublishDialog } from "./publish-dialog";
import { useDraft } from "./shared/use-draft";
import { PresetUsage } from "./preset-usage";
import { PresetVersions } from "./preset-versions";

const TABS = ["edit", "versions", "usage"] as const;
type Tab = (typeof TABS)[number];

/**
 * S20 (FE-021 frame): the preset's header (name, layer, based on, latest version, draft, actions) and
 * its tabs: Edit (the draft; the editors of FE-022…FE-024 go here), Versions (history, view, compare,
 * restore as draft) and Where used.
 */
export function PresetPage({ presetId }: { presetId: string }) {
  const t = useTranslations("library");
  const message = useErrorMessage();
  const { org, can } = useOrg();
  const preset = usePreset(presetId);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tabParam = params.get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as Tab) : "edit";
  const setTab = (next: Tab) => {
    const q = new URLSearchParams();
    if (next !== "edit") q.set("tab", next);
    router.replace(`${pathname}${q.size ? `?${q}` : ""}`, { scroll: false });
  };

  if (preset.isError) {
    return (
      <p role="alert" className="text-error">
        {message(preset.error)}
      </p>
    );
  }
  if (!preset.data) return <div aria-busy="true" />;
  const p = preset.data;
  const editable = p.permissions?.edit === true;
  return (
    <div className="flex flex-col gap-6" data-testid="preset-page" data-preset={p.id}>
      <PresetHeader preset={p} canCopy={can("editLibrary")} orgId={org.id} orgSlug={org.slug} />
      <nav aria-label={t("preset.tabs")} className="flex gap-6 border-b border-border">
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            aria-current={k === tab ? "page" : undefined}
            data-testid={`preset-tab-${k}`}
            className={cn("label-caps -mb-px border-b-2 border-transparent pb-2 text-muted-foreground hover:text-foreground", k === tab && "border-link text-foreground")}
          >
            {t(`preset.tab.${k}`)}
            {k === "usage" && <span className="ml-1 tabular-nums">{p.usedByCount ?? 0}</span>}
          </button>
        ))}
      </nav>
      {tab === "edit" && <EditTab preset={p} editable={editable} />}
      {tab === "versions" && <PresetVersions preset={p} editable={editable} />}
      {tab === "usage" && <PresetUsage preset={p} />}
    </div>
  );
}

function PresetHeader({ preset: p, canCopy, orgId, orgSlug }: { preset: Preset; canCopy: boolean; orgId: string; orgSlug: string }) {
  const t = useTranslations("library");
  const relativeTime = useRelativeTime();
  const router = useRouter();
  const editable = p.permissions?.edit === true;
  const update = useUpdatePreset(p.id);
  const archive = useArchivePreset(p.id);
  const back = p.projectId ? `/${orgSlug}/projects/${p.projectId}/library?kind=${p.kind}` : `/${orgSlug}/library?kind=${p.kind}`;
  const copyFrom = p.latestPublishedVersion?.id ?? p.draft?.id;
  return (
    <div className="flex flex-col gap-3">
      <Link href={back} className="text-muted-foreground hover:underline">
        {t(p.projectId ? "preset.backToProject" : "preset.backToLibrary")}
      </Link>
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-title" data-testid="preset-name">
          {p.name}
        </h1>
        <Tag>{t(`kindsOne.${p.kind}`)}</Tag>
        <Tag data-testid="preset-layer">{t(`layers.${p.layer}`)}</Tag>
        {p.starred && <Tag title={t("preset.starredHint")}>{t("preset.starred")}</Tag>}
        {p.archived && <Tag data-testid="preset-archived">{t("preset.archived")}</Tag>}
      </div>
      {p.description && <p>{p.description}</p>}
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
        {p.basedOn && (
          <div className="flex gap-1">
            <dt>{t("preset.basedOn")}</dt>
            <dd className="text-foreground">{p.basedOn}</dd>
          </div>
        )}
        <div className="flex gap-1">
          <dt>{t("preset.latest")}</dt>
          <dd className="text-foreground tabular-nums" data-testid="preset-latest">
            {p.latestPublishedVersion ? t("preset.versionN", { n: p.latestPublishedVersion.number ?? 0 }) : t("preset.unpublished")}
          </dd>
        </div>
        {p.draft && (
          <div className="flex gap-1">
            <dt>{t("preset.draft")}</dt>
            <dd className="text-foreground" data-testid="preset-draft">
              {p.draft.problemCount ? t("preset.problems", { n: p.draft.problemCount }) : t("preset.noProblems")}
            </dd>
          </div>
        )}
        {p.layer !== "system" && p.updatedAt && (
          <div className="flex gap-1">
            <dt>{t("preset.lastEdit")}</dt>
            <dd className="tabular-nums">{p.updatedBy ? t("preset.editedBy", { name: p.updatedBy.name, when: relativeTime(p.updatedAt) }) : relativeTime(p.updatedAt)}</dd>
          </div>
        )}
      </dl>
      {p.archived && (
        <p className="rounded-[var(--radius)] border border-border bg-muted px-3 py-2" role="status">
          {t("preset.archivedNote")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {editable && <DetailsDialog preset={p} />}
        {editable && p.layer === "org" && (
          <Button variant="outline" onClick={() => update.mutate({ starred: !p.starred })} disabled={update.isPending} data-testid="preset-star">
            {t(p.starred ? "preset.unstar" : "preset.star")}
          </Button>
        )}
        {canCopy && copyFrom && <CloneDialog preset={p} orgId={orgId} orgSlug={orgSlug} />}
        {editable && (
          <ConfirmDialog
            trigger={<Button variant="outline" data-testid="preset-archive" />}
            title={t("preset.archiveTitle", { name: p.name })}
            body={t("preset.archiveBody")}
            confirm={t("preset.archive")}
            testId="preset-archive-confirm"
            onConfirm={async () => {
              await archive.mutateAsync();
              toast(t("preset.archivedToast", { name: p.name }));
              router.push(back);
            }}
          />
        )}
      </div>
    </div>
  );
}

/** Name, description and "based on" (free text, BR-53). */
function DetailsDialog({ preset: p }: { preset: Preset }) {
  const t = useTranslations("library");
  const message = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(p.name);
  const [description, setDescription] = useState(p.description ?? "");
  const [basedOn, setBasedOn] = useState(p.basedOn ?? "");
  const update = useUpdatePreset(p.id);
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setName(p.name);
          setDescription(p.description ?? "");
          setBasedOn(p.basedOn ?? "");
          update.reset();
          setOpen(true);
        }}
        data-testid="preset-details"
      >
        {t("preset.editDetails")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="preset-details-dialog">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              update.mutate({ name: name.trim(), description: description.trim(), basedOn: basedOn.trim() }, { onSuccess: () => setOpen(false) });
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("preset.editDetails")}</DialogTitle>
              <DialogDescription>{t("preset.detailsHint")}</DialogDescription>
            </DialogHeader>
            <Field id="details-name" label={t("create.name")} error={update.error ? message(update.error) : undefined}>
              <Input id="details-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="details-name" />
            </Field>
            <Field id="details-description" label={`${t("create.description")} (${t("create.optional")})`}>
              <Input id="details-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field id="details-based-on" label={`${t("create.basedOn")} (${t("create.optional")})`} hint={t("create.basedOnHint")}>
              <Input id="details-based-on" value={basedOn} onChange={(e) => setBasedOn(e.target.value)} />
            </Field>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>{t("create.cancel")}</DialogClose>
              <Button type="submit" disabled={!name.trim() || update.isPending} data-testid="details-save">
                {t("preset.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * The document in its editor (FE-022 rule sets, FE-023 classifications, FE-024 dictionaries; the
 * advanced kinds as JSON). The first change starts a draft; "Discard draft" goes back to the latest
 * version.
 */
function EditTab({ preset: p, editable }: { preset: Preset; editable: boolean }) {
  const t = useTranslations("library");
  const relativeTime = useRelativeTime();
  const params = useSearchParams();
  const discard = useDiscardDraft(p.id);
  const draft = useDraft<unknown>(p);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { org } = useOrg();
  const [screen, setScreen] = useState(0);
  // Guided mode (F10 §2, P24): the setup wizard's step for this kind, one topic at a time.
  const canGuide = editable && (p.kind === "rule_set" || p.kind === "classification");
  const guided = canGuide && params.get("mode") === "guided";
  const setGuided = (on: boolean) => router.replace(on ? `${pathname}?mode=guided` : pathname, { scroll: false });
  return (
    <PreviewResultContext.Provider value={previewResult}>
      <div className="flex flex-col gap-4" data-testid="preset-edit">
      <div className="flex flex-wrap items-center gap-2">
        {canGuide && (
          <Button variant="outline" onClick={() => setGuided(!guided)} data-testid={guided ? "full-editor" : "guided-mode"}>
            {t(guided ? "guided.full" : "guided.open")}
          </Button>
        )}
        {!guided && <TemplateTools preset={p} draft={draft} editable={editable} />}
      </div>
      {p.draft ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex-1">
            {t("edit.draftSaved", { when: p.draft.updatedAt ? relativeTime(p.draft.updatedAt) : "" })}
            {p.latestPublishedVersion && ` ${t("edit.draftOver", { n: p.latestPublishedVersion.number ?? 0 })}`}
          </p>
          {editable && (
            <ConfirmDialog
              trigger={<Button variant="outline" data-testid="discard-draft" />}
              title={t("edit.discardTitle")}
              body={t(p.latestPublishedVersion ? "edit.discardBody" : "edit.discardBodyNoVersion")}
              confirm={t("edit.discard")}
              testId="discard-draft-confirm"
              destructive
              onConfirm={() => discard.mutateAsync()}
            />
          )}
          {editable && <PublishDialog preset={p} draft={draft} />}
        </div>
      ) : (
        <p className="text-muted-foreground">{p.layer === "system" ? t("edit.system") : editable ? t("edit.noDraft", { n: p.latestPublishedVersion?.number ?? 0 }) : t("edit.readOnly")}</p>
      )}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
        {guided && p.kind === "rule_set" ? (
          <MeasureStep preset={p} draft={draft} orgSlug={org.slug} screenIndex={screen} onScreen={setScreen} onDone={() => setGuided(false)} />
        ) : guided ? (
          <div className="flex flex-col gap-3" data-testid="guided-items">
            <p className="text-muted-foreground">{t("guided.itemsIntro")}</p>
            <PresetEditor preset={p} draft={draft} editable={editable} />
          </div>
        ) : (
          <PresetEditor preset={p} draft={draft} editable={editable} question={params.get("question")} />
        )}
        {(p.kind === "rule_set" || p.kind === "classification" || p.kind === "dictionary") && <PreviewPanel preset={p} saves={draft.saves} onResult={setPreviewResult} />}
      </div>
      </div>
    </PreviewResultContext.Provider>
  );
}
