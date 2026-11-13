"use client";

/**
 * "Names in the model" (the PoC's NamesTab.tsx, F10 §7): every material and type name a model
 * version uses, what it means under this draft plus the more general dictionaries it builds on,
 * and a way to give it a term.
 *
 * The PoC used the model loaded in the BoQ view; here the user picks project → model → a ready
 * version. Assigning writes ordinary entries into the draft: an exact match per name, or one
 * "starts with" entry for several similar names, optionally only on some IFC classes. The engine
 * resolves the names (`POST /model-versions/{id}/names`); nothing is matched in the browser.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import type { Dictionary, NameUse } from "@ifc-boq/types";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import { useLibraryPresets, type Preset } from "@/api/hooks/library";
import { useProjects } from "@/api/hooks/projects";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrg } from "@/features/orgs/org-context";
import { cn } from "@/lib/utils";
import { Field, Options, inputClass, linkButton, matches } from "../shared/fields";
import { useStoryWords } from "../shared/story";
import { useVocab } from "../shared/use-vocab";
import { useDictWords } from "./dict-story";
import { LAYER_RANK, assignNames, commonPrefix, forgetName, rowOrder, rowsOf, suggestTerm, type Group, type KnownTerm, type Row, type Status } from "./names";

/** The system dictionary every other dictionary builds on. */
export const GLOBAL_SEED_SLUG = "global-seed";
const PRESET_LAYER_RANK: Record<Preset["layer"], number> = { system: 0, org: 1, project: 2 };

/** What the user picked in the tab; kept by the editor so it survives switching tabs. */
export interface NamesPick {
  projectId?: string;
  modelId?: string;
  versionId?: string;
  /** Dictionary presets to resolve with besides the draft; undefined = the global seed. */
  withIds?: string[];
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/* ---------------------------------------------------------------- model version picker */

function useVersionChoice(preset: Preset, pick: NamesPick) {
  const { org } = useOrg();
  const projects = useProjects(org.id);
  const projectList = (projects.data ?? []).filter((p) => !preset.projectId || p.id === preset.projectId);
  const projectId = preset.projectId ?? (pick.projectId && projectList.some((p) => p.id === pick.projectId) ? pick.projectId : projectList.find((p) => (p.counts?.models ?? 0) > 0)?.id);
  const models = useQuery({
    queryKey: keys.models(projectId ?? "none"),
    enabled: !!projectId,
    queryFn: async () => (await api.GET("/projects/{projectId}/models", { params: { path: { projectId: projectId! } } })).data!,
  });
  const modelList = (models.data ?? []).filter((m) => !m.archived);
  const modelId = pick.modelId && modelList.some((m) => m.id === pick.modelId) ? pick.modelId : (modelList.find((m) => m.latestVersion?.status === "ready") ?? modelList[0])?.id;
  const versions = useQuery({
    queryKey: keys.modelVersions(modelId ?? "none"),
    enabled: !!modelId,
    queryFn: async () => (await api.GET("/models/{modelId}/versions", { params: { path: { modelId: modelId! } } })).data!,
  });
  const ready = (versions.data ?? []).filter((v) => v.status === "ready").sort((a, b) => b.number - a.number);
  const version = ready.find((v) => v.id === pick.versionId) ?? ready[0];
  return { projects, projectList, projectId, models, modelList, modelId, versions, ready, version };
}

/* ---------------------------------------------------------------- term picker */

/**
 * A term by id (a datalist of the known terms). Picking from the list applies it; typed text is
 * applied with Enter or the button. Text that is not a known term goes back to the current value.
 */
function TermPicker({ value, terms, listId, onPick, placeholder, label, inputTestId, buttonTestId }: {
  value?: string | null;
  terms: KnownTerm[];
  /** The datalist of the known terms (one per tab, not one per row). */
  listId: string;
  onPick: (id: string) => void;
  placeholder?: string;
  label: string;
  inputTestId?: string;
  buttonTestId?: string;
}) {
  const t = useTranslations("dictionaryEditor.names");
  const [draft, setDraft] = useState(value ?? "");
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value ?? "");
  }
  const byLabel = new Map(terms.map((x) => [`${x.label} (${x.id})`, x.id]));
  const resolve = (s: string) => {
    const x = s.trim();
    return terms.some((k) => k.id === x) ? x : byLabel.get(x);
  };
  const target = resolve(draft);
  const commit = (s: string) => {
    const termId = resolve(s);
    if (termId && termId !== value) onPick(termId);
    else if (!termId) setDraft(value ?? "");
  };
  return (
    <div className="flex min-w-0 items-center gap-1">
      <input
        type="text"
        className={cn(inputClass, "font-mono")}
        list={listId}
        value={draft}
        placeholder={placeholder ?? t("pickTerm")}
        aria-label={label}
        data-testid={inputTestId}
        onChange={(e) => {
          setDraft(e.target.value);
          // A choice from the datalist arrives without typing: apply it right away (as the PoC did).
          const native = e.nativeEvent;
          const picked = typeof InputEvent === "undefined" || !(native instanceof InputEvent) || native.inputType === "insertReplacementText";
          if (picked && resolve(e.target.value)) commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          }
        }}
      />
      <Button type="button" size="sm" variant="outline" disabled={!target || target === value} onClick={() => commit(draft)} data-testid={buttonTestId}>
        {t("assign")}
      </Button>
    </div>
  );
}

/* ---------------------------------------------------------------- the tab */

export function NamesTab({ preset, doc, onChange, known, pick, onPick }: {
  preset: Preset;
  doc: Dictionary;
  onChange: (d: Dictionary) => void;
  known: KnownTerm[];
  pick: NamesPick;
  onPick: (p: NamesPick) => void;
}) {
  const t = useTranslations("dictionaryEditor.names");
  const format = useFormatter();
  const message = useErrorMessage();
  const words = useDictWords();
  const story = useStoryWords();
  const vocab = useVocab();
  const { org } = useOrg();
  const termListId = useId();
  const choice = useVersionChoice(preset, pick);
  const versionId = choice.version?.id;

  // The more general layers: other dictionary presets with a published version; by default the global seed.
  const presets = useLibraryPresets(org.id, preset.projectId ?? undefined, { kind: "dictionary" });
  const others = (presets.data ?? [])
    .filter((p) => p.id !== preset.id && !p.archived && p.latestPublishedVersion)
    .sort((a, b) => PRESET_LAYER_RANK[a.layer] - PRESET_LAYER_RANK[b.layer] || a.name.localeCompare(b.name));
  const withIds = pick.withIds ?? others.filter((p) => p.slug === GLOBAL_SEED_SLUG && p.layer === "system").map((p) => p.id);
  const layerVersionIds = others.filter((p) => withIds.includes(p.id)).map((p) => p.latestPublishedVersion!.id);

  const [group, setGroup] = useState<Group>("materials");
  const [status, setStatus] = useState<Status>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkPrefix, setBulkPrefix] = useState(false);
  const [bulkOnly, setBulkOnly] = useState(false);

  // The draft goes with every request (most specific last), a moment after the last change.
  const draft = useDebounced(JSON.stringify(doc), 350);
  const names = useQuery({
    queryKey: [...keys.names(versionId ?? "none"), { layers: layerVersionIds, draft }],
    enabled: !!versionId && !presets.isPending,
    // Keep the table while the same version re-resolves; another version starts empty.
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === versionId ? prev : undefined),
    queryFn: async () =>
      (
        await api.POST("/model-versions/{versionId}/names", {
          params: { path: { versionId: versionId! } },
          body: { dictionaryVersionIds: layerVersionIds, draftDictionaries: [JSON.parse(draft)] },
        })
      ).data!,
  });

  const rank = LAYER_RANK[doc.layer];
  const label = (id: string | null) => (id ? (known.find((k) => k.id === id)?.label ?? id) : null);
  const dictName = (id?: string) => (id === doc.id ? t("thisDictionary") : (others.find((p) => p.slug === id)?.name ?? id ?? ""));
  const rows = useMemo(() => (names.data ? rowsOf(names.data.names as NameUse[]) : []), [names.data]);
  const inGroup = rows.filter((r) => r.group === group);
  const here = (r: Row) => r.uses.some((u) => u.dictionary === doc.id);
  const shown = inGroup
    .filter((r) => (status === "unresolved" ? !r.term : status === "here" ? here(r) : status === "elsewhere" ? !!r.term && !here(r) : true))
    .filter((r) => matches(q, r.raw, r.term ?? "", label(r.term) ?? ""))
    .sort(rowOrder);
  const counts = (g: Group) => {
    const l = rows.filter((r) => r.group === g);
    return { all: l.length, open: l.filter((r) => !r.term).length };
  };
  const classes = (list: string[]) => story.joinAnd(list.map((c) => vocab.classWords(c)));

  const assign = (list: Row[], term: string, opts: { prefix?: string; classes?: string[] } = {}) => {
    onChange(assignNames(doc, list, term, opts));
    setSelected([]);
  };

  const sel = shown.filter((r) => selected.includes(r.key));
  const prefix = commonPrefix(sel.map((r) => r.raw));
  const selClasses = [...new Set(sel.flatMap((r) => r.classes))].sort();

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="names-tab">
      <VersionPicker choice={choice} pick={pick} onPick={onPick} />
      <Options id={termListId} values={known.map((x) => x.id)} labels={Object.fromEntries(known.map((x) => [x.id, t("termOption", { label: x.label, category: words.categoryShort(x.category) })]))} />

      {versionId && choice.version && (
        <>
          <p className="prose-text text-muted-foreground">{t.rich("intro", { b: (c) => <b className="text-foreground">{c}</b>, file: choice.version.fileName, layer: words.layer(doc.layer) })}</p>
          <div className="flex flex-wrap items-center gap-1">
            <span className="label-caps mr-2 text-muted-foreground">{t("resolvedWith")}</span>
            <span className="rounded-[var(--radius)] border border-foreground bg-foreground px-1.5 py-0.5 text-background">{t("thisChip", { name: doc.name || doc.id, layer: words.layer(doc.layer) })}</span>
            {others.map((p) => {
              const on = withIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  data-testid="names-layer"
                  data-slug={p.slug}
                  className={cn("rounded-[var(--radius)] border border-border px-1.5 py-0.5 hover:bg-muted", on && "border-link text-link")}
                  onClick={() => onPick({ ...pick, withIds: on ? withIds.filter((x) => x !== p.id) : [...withIds, p.id] })}
                >
                  {t("otherChip", { name: p.name, layer: t(`presetLayers.${p.layer}`) })}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex" role="group" aria-label={t("groupsLabel")}>
              {(["materials", "types"] as const).map((g) => {
                const c = counts(g);
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={group === g}
                    data-testid={`names-group-${g}`}
                    className={cn("flex h-8 items-center gap-2 border border-border px-2 first:rounded-l-[var(--radius)] last:rounded-r-[var(--radius)] hover:bg-muted", group === g && "border-foreground bg-foreground text-background hover:bg-foreground/90")}
                    onClick={() => {
                      setGroup(g);
                      setSelected([]);
                    }}
                  >
                    {t(`groups.${g}`)}
                    <span className="tabular-nums opacity-70">{format.number(c.all)}</span>
                    {c.open > 0 && <span className="label-caps rounded-[var(--radius)] bg-attention px-1 text-on-fill">{t("open", { n: c.open })}</span>}
                  </button>
                );
              })}
            </div>
            <select className={cn(inputClass, "w-auto")} value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label={t("statusLabel")} data-testid="names-status">
              {(["all", "unresolved", "here", "elsewhere"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              ))}
            </select>
            <input type="search" className={cn(inputClass, "w-48")} placeholder={t("filter")} aria-label={t("filter")} value={q} onChange={(e) => setQ(e.target.value)} />
            {names.isFetching && (
              <span className="text-muted-foreground" role="status">
                {t("resolving")}
              </span>
            )}
          </div>

          {names.isError && (
            <p className="text-error" role="alert">
              {message(names.error)}
            </p>
          )}
          {names.data && inGroup.some((r) => !r.term) && <p className="prose-text text-muted-foreground">{inGroup.some((r) => !r.term && r.worthAsking) ? t("worthHint") : t("notWorthHint")}</p>}

          {sel.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-link bg-selection p-2" data-testid="names-bulk">
              <b>{t("selected", { n: sel.length })}</b>
              <span>{t("mean")}</span>
              <div className="w-72">
                <TermPicker
                  terms={known}
                  listId={termListId}
                  label={t("bulkTerm")}
                  inputTestId="names-bulk-term"
                  buttonTestId="names-bulk-assign"
                  onPick={(term) => assign(sel, term, { prefix: bulkPrefix && prefix ? prefix : undefined, classes: bulkOnly ? selClasses : undefined })}
                />
              </div>
              {prefix && (
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={bulkPrefix} onChange={(e) => setBulkPrefix(e.target.checked)} />
                  <span>{t.rich("asPrefix", { b: (c) => <b>{c}</b>, prefix })}</span>
                </label>
              )}
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={bulkOnly} onChange={(e) => setBulkOnly(e.target.checked)} />
                <span>{t("onlyOn", { classes: classes(selClasses) })}</span>
              </label>
              <button type="button" className={linkButton} onClick={() => setSelected([])}>
                {t("clear")}
              </button>
            </div>
          )}

          {names.data && (
            <Table data-testid="names-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <span className="sr-only">{t("columns.select")}</span>
                  </TableHead>
                  <TableHead className="label-caps">{t("columns.name")}</TableHead>
                  <TableHead className="label-caps text-right">{t("columns.elements")}</TableHead>
                  <TableHead className="label-caps">{t("columns.usedOn")}</TableHead>
                  <TableHead className="label-caps">{t("columns.means")}</TableHead>
                  <TableHead className="label-caps">{t("columns.knownFrom")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      {t("noMatch")}
                    </TableCell>
                  </TableRow>
                )}
                {shown.map((r) => {
                  const use = r.uses.find((u) => u.term) ?? r.uses[0]!;
                  const mine = here(r);
                  const higher = !!r.term && !mine && !!use.layer && LAYER_RANK[use.layer] > rank;
                  const suggestion = !r.term ? suggestTerm(r.raw, known) : null;
                  const extracted = Object.entries(use.extracted ?? {});
                  return (
                    <TableRow key={r.key} data-testid="name-row" data-name={r.raw} data-term={r.term ?? ""} className="align-top">
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={t("selectRow", { name: r.raw })}
                          checked={selected.includes(r.key)}
                          onChange={(e) => setSelected(e.target.checked ? [...selected, r.key] : selected.filter((k) => k !== r.key))}
                        />
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <div className="flex flex-wrap items-center gap-2">
                          <b>{r.raw}</b>
                          {r.worthAsking && <span className="label-caps rounded-[var(--radius)] bg-attention px-1 text-on-fill">{t("worthAnswering")}</span>}
                        </div>
                        {extracted.length > 0 && (
                          <div className="text-muted-foreground">
                            {t("readFromName", { values: story.joinAnd(extracted.map(([k, v]) => t("extractedValue", { name: words.target(k), value: typeof v === "number" ? format.number(v) : String(v) }))) })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{format.number(r.count)}</TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">{classes(r.classes)}</TableCell>
                      <TableCell className="min-w-64 whitespace-normal">
                        <TermPicker
                          value={r.term}
                          terms={known}
                          listId={termListId}
                          label={t("termOf", { name: r.raw })}
                          placeholder={r.term ? undefined : t("notUnderstood")}
                          inputTestId="name-term"
                          buttonTestId="name-assign"
                          onPick={(term) => assign([r], term)}
                        />
                        {r.term && <div className="text-muted-foreground">{label(r.term)}</div>}
                        {suggestion && (
                          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                            <span>{t.rich("suggestion", { b: (c) => <b className="text-foreground">{c}</b>, label: suggestion.label })}</span>
                            <button type="button" className={linkButton} data-testid="name-suggestion" onClick={() => assign([r], suggestion.id)}>
                              {t("use")}
                            </button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {r.term ? (
                          <div className="flex flex-col items-start">
                            <span>{dictName(use.dictionary)}</span>
                            <span className="text-muted-foreground">
                              {t("how", {
                                layer: words.layer(use.layer ?? "global"),
                                method: t.has(`methods.${use.method}`) ? t(`methods.${use.method}`) : use.method,
                                hasEntry: use.entryId ? "yes" : "no",
                                entry: use.entryId ?? "",
                              })}
                            </span>
                            {mine && use.method === "exact" && (
                              <button type="button" className={linkButton} title={t("removeHereTitle")} data-testid="name-forget" onClick={() => onChange(forgetName(doc, r))}>
                                {t("removeHere")}
                              </button>
                            )}
                            {higher && <span className="text-muted-foreground">{t("higher", { layer: words.layer(use.layer!) })}</span>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">{t("noDictionary")}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}

function VersionPicker({ choice, pick, onPick }: { choice: ReturnType<typeof useVersionChoice>; pick: NamesPick; onPick: (p: NamesPick) => void }) {
  const t = useTranslations("dictionaryEditor.names");
  const { projects, projectList, projectId, models, modelList, modelId, versions, ready, version } = choice;
  const loading = projects.isPending || (!!projectId && models.isPending) || (!!modelId && versions.isPending);
  const empty = projects.isSuccess && projectList.length === 0 ? t("noProjects") : projectId && models.isSuccess && modelList.length === 0 ? t("noModels") : modelId && versions.isSuccess && ready.length === 0 ? t("noReadyVersion") : !version && !loading ? t("pickHint") : null;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label={t("project")}>
          <select className={inputClass} value={projectId ?? ""} data-testid="names-project" onChange={(e) => onPick({ ...pick, projectId: e.target.value || undefined, modelId: undefined, versionId: undefined })}>
            {!projectId && <option value="">{t("chooseProject")}</option>}
            {projectList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("model")}>
          <select className={inputClass} value={modelId ?? ""} data-testid="names-model" disabled={!projectId} onChange={(e) => onPick({ ...pick, projectId, modelId: e.target.value || undefined, versionId: undefined })}>
            {!modelId && <option value="">{t("chooseModel")}</option>}
            {modelList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("version")}>
          <select className={inputClass} value={version?.id ?? ""} data-testid="names-version" disabled={!modelId} onChange={(e) => onPick({ ...pick, projectId, modelId, versionId: e.target.value || undefined })}>
            {!version && <option value="">{t("chooseVersion")}</option>}
            {ready.map((v) => (
              <option key={v.id} value={v.id}>
                {t("versionOption", { n: v.number, file: v.fileName })}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {loading && <p className="text-muted-foreground">{t("loading")}</p>}
      {empty && <p className="text-muted-foreground">{empty}</p>}
    </div>
  );
}
