"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@ifc-boq/api";
import type { RuleSet } from "@ifc-boq/types";
import { api } from "@/api/client";
import { isApiError } from "@/api/errors";
import { usePresetVersion, type Preset, type PresetVersion } from "@/api/hooks/library";
import { keys } from "@/api/keys";

/** How long after the last change a draft is saved (F10 §3). */
export const AUTOSAVE_MS = 1000;

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "conflict" | "error";

export interface Draft<D> {
  /** The document being edited: the draft's, or the latest version's until the first change. */
  doc: D | undefined;
  /** Change the document; saved `AUTOSAVE_MS` after the last change (the first save starts the draft). */
  setDoc: (next: D) => void;
  status: SaveStatus;
  /** The engine's problems with the last saved document (from the save's check). */
  problems: string[];
  /** For a rule-set patch: the parent as the engine flattens it; null while loading or for other kinds. */
  parent: RuleSet | null;
  /** Someone saved the draft after this tab read it (409 `draft_conflict`): reload theirs or overwrite. */
  conflict: boolean;
  reload: () => Promise<void>;
  overwrite: () => Promise<void>;
  /** Counts successful saves (a preview re-runs after each). */
  saves: number;
  /** Save now (before publishing or leaving). */
  flush: () => Promise<void>;
  error: unknown;
}

type Saved = Schemas["PresetVersion"];

/**
 * A preset's draft in the editor (F10 §3): loaded once, edited locally, saved through
 * `PUT /presets/{id}/draft` with `If-Match` (the ETag of what this tab last read or saved). A draft
 * saved elsewhere in between answers `409 draft_conflict`, which is handled here (not by the global
 * 409 toast): the editor asks to reload or overwrite. Every save returns the engine's problems.
 */
export function useDraft<D>(preset: Preset): Draft<D> {
  const client = useQueryClient();
  const source = preset.draft ?? preset.latestPublishedVersion;
  const loaded = usePresetVersion(source?.id, preset.draft?.etag);
  const [doc, setLocal] = useState<D | undefined>(undefined);
  const [problems, setProblems] = useState<string[]>([]);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [extendsVersionId, setExtends] = useState<string | null>(null);
  const [saves, setSaves] = useState(0);
  const etag = useRef<string | undefined>(undefined);
  const latest = useRef<D | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialised = useRef<string | null>(null);
  /** Local edits not saved yet (a pending timer or a save in flight). */
  const dirty = useRef(false);

  // Take the server's document once per preset (and again after reload / discard), never on the
  // refetches our own saves cause.
  const adopt = useCallback((v: PresetVersion) => {
    const d = structuredClone(v.doc) as D;
    latest.current = d;
    dirty.current = false;
    setLocal(d);
    setProblems(v.problems);
    setExtends(v.extendsVersionId ?? null);
    etag.current = v.status === "draft" ? v.etag : undefined;
    setConflict(false);
    setStatus("idle");
  }, []);
  useEffect(() => {
    if (!loaded.data) return;
    const key = `${preset.id}:${preset.draft ? "draft" : (preset.latestPublishedVersion?.id ?? "")}`;
    if (initialised.current === key) return;
    initialised.current = key;
    // Edits made since (e.g. right after publishing) win: only the ETag follows the server, so the
    // next save starts a new draft. Otherwise a draft discarded or published falls back to the latest version.
    if (dirty.current) {
      etag.current = loaded.data.status === "draft" ? loaded.data.etag : undefined;
      return;
    }
    adopt(loaded.data);
  }, [loaded.data, preset.id, preset.draft, preset.latestPublishedVersion?.id, adopt]);

  const parentVersion = usePresetVersion(preset.kind === "rule_set" ? (extendsVersionId ?? undefined) : undefined);
  const parent = (parentVersion.data ? ((parentVersion.data.flattened ?? parentVersion.data.doc) as RuleSet) : null) ?? null;

  const save = useCallback(
    async (force = false) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const body = latest.current;
      if (body === undefined) return;
      setStatus("saving");
      try {
        const res = await api.PUT("/presets/{presetId}/draft", {
          params: { path: { presetId: preset.id }, ...(etag.current && !force ? { header: { "If-Match": etag.current } } : {}) },
          body: { doc: body },
        });
        const saved = res.data as Saved;
        etag.current = saved.etag ?? res.response.headers.get("ETag") ?? undefined;
        setProblems(saved.problems);
        setExtends(saved.extendsVersionId ?? null);
        setConflict(false);
        setError(null);
        // Our own save: the preset (draft, problem count) and its versions change; the document doesn't.
        initialised.current = `${preset.id}:draft`;
        if (latest.current === body) {
          dirty.current = false;
          setStatus("saved");
        }
        setSaves((n) => n + 1);
        void client.invalidateQueries({ queryKey: keys.preset(preset.id) });
        void client.invalidateQueries({ queryKey: keys.presetVersions(preset.id) });
        void client.invalidateQueries({ queryKey: ["presets"] });
      } catch (e) {
        if (isApiError(e) && e.status === 409 && e.code === "draft_conflict") {
          setConflict(true);
          setStatus("conflict");
        } else {
          setError(e);
          setStatus("error");
        }
      }
    },
    [client, preset.id],
  );

  const setDoc = useCallback(
    (next: D) => {
      latest.current = next;
      dirty.current = true;
      setLocal(next);
      setStatus("pending");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
    },
    [save],
  );

  // Leaving the page saves what is pending.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void save();
      }
    },
    [save],
  );

  const reload = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const fresh = await client.fetchQuery({ queryKey: keys.preset(preset.id), queryFn: async () => (await api.GET("/presets/{presetId}", { params: { path: { presetId: preset.id } } })).data!, staleTime: 0 });
    const id = fresh.draft?.id ?? fresh.latestPublishedVersion?.id;
    if (!id) return;
    const v = (await api.GET("/preset-versions/{presetVersionId}", { params: { path: { presetVersionId: id } } })).data!;
    initialised.current = `${preset.id}:${fresh.draft ? "draft" : (fresh.latestPublishedVersion?.id ?? "")}`;
    adopt(v);
  }, [adopt, client, preset.id]);

  return {
    doc,
    setDoc,
    status,
    problems,
    parent,
    conflict,
    reload,
    saves,
    overwrite: () => save(true),
    flush: () => (timer.current || status === "pending" ? save() : Promise.resolve()),
    error,
  };
}
