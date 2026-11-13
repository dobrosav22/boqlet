import type { ComponentProps } from "react";
import type { Preset, PresetKind } from "@/api/hooks/library";
import { cn } from "@/lib/utils";

/** The Library's kinds in tab order (F10 "Concepts"; federation and resolution are advanced). */
export const LIBRARY_KINDS = ["rule_set", "classification", "dictionary", "federation", "resolution"] as const satisfies readonly PresetKind[];

export const isLibraryKind = (s: string | null | undefined): s is PresetKind => !!s && (LIBRARY_KINDS as readonly string[]).includes(s);

/** Org slug + kind + id: the preset page (S20). Project presets open there too. */
export const presetHref = (orgSlug: string, preset: Pick<Preset, "kind" | "id">) => `/${orgSlug}/library/${preset.kind}/${preset.id}`;

/** The create page (S20 "new"), optionally starting from a version, for a project. */
export function createHref(orgSlug: string, kind: PresetKind, opts: { mode?: "empty" | "copy" | "patch"; from?: string; projectId?: string } = {}) {
  const q = new URLSearchParams();
  if (opts.mode) q.set("mode", opts.mode);
  if (opts.from) q.set("from", opts.from);
  if (opts.projectId) q.set("project", opts.projectId);
  const s = q.toString();
  return `/${orgSlug}/library/${kind}/new${s ? `?${s}` : ""}`;
}

/** A small outlined label (layer, draft, archived), as the rest of the app draws them. */
export function Tag({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("label-caps rounded-[var(--radius)] border border-border px-1 whitespace-nowrap", className)} {...props} />;
}
