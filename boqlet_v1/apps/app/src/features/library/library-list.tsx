"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLibraryPresets, type Preset, type PresetKind, type PresetLayer } from "@/api/hooks/library";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrg } from "@/features/orgs/org-context";
import { useRelativeTime } from "@/i18n/use-relative-time";
import { cn } from "@/lib/utils";
import { createHref, isLibraryKind, LIBRARY_KINDS, presetHref, Tag } from "./kinds";

/**
 * The Library's tables (F10 §1): one tab per kind; name, layer, based on, latest version, draft, last
 * edit, used by. System presets are read-only with "Make a copy". The org Library filters by layer;
 * a project's Library lists only its own presets (`projectId`). Tab and filters live in the URL.
 */
export function LibraryList({ projectId, canCreate }: { projectId?: string; canCreate: boolean }) {
  const t = useTranslations("library");
  const message = useErrorMessage();
  const relativeTime = useRelativeTime();
  const { org } = useOrg();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const kindParam = params.get("kind");
  const kind: PresetKind = isLibraryKind(kindParam) ? kindParam : "rule_set";
  const layerParam = params.get("layer");
  const layer: PresetLayer | undefined = projectId ? "project" : layerParam === "system" || layerParam === "org" ? layerParam : undefined;
  const archived = params.get("archived") === "1";
  const presets = useLibraryPresets(org.id, projectId, { kind, ...(layer ? { layer } : {}), ...(archived ? { includeArchived: true } : {}) });

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    const s = next.toString();
    router.replace(`${pathname}${s ? `?${s}` : ""}`, { scroll: false });
  };

  const rows = [...(presets.data ?? [])].sort((a, b) => layerOrder(a) - layerOrder(b) || a.name.localeCompare(b.name));
  return (
    <div className="flex flex-col gap-4" data-testid="library-list">
      <nav aria-label={t("home.kinds")} className="flex gap-6 border-b border-border">
        {LIBRARY_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setParam("kind", k === "rule_set" ? null : k)}
            aria-current={k === kind ? "page" : undefined}
            data-testid={`library-kind-${k}`}
            className={cn("label-caps -mb-px border-b-2 border-transparent pb-2 text-muted-foreground hover:text-foreground", k === kind && "border-link text-foreground")}
          >
            {t(`kinds.${k}`)}
          </button>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-muted-foreground">{t(`hints.${kind}`)}</p>
        {!projectId && (
          <NativeSelect aria-label={t("home.layer")} value={layer ?? "all"} onChange={(e) => setParam("layer", e.target.value === "all" ? null : e.target.value)} data-testid="library-layer">
            <option value="all">{t("home.allLayers")}</option>
            <option value="org">{t("layers.org")}</option>
            <option value="system">{t("layers.system")}</option>
          </NativeSelect>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={archived} onChange={(e) => setParam("archived", e.target.checked ? "1" : null)} data-testid="library-archived" />
          {t("home.showArchived")}
        </label>
        {canCreate && (
          <Button render={<Link href={createHref(org.slug, kind, { projectId })} />} nativeButton={false} data-testid="library-new">
            {t(`home.new.${kind}`)}
          </Button>
        )}
      </div>
      {presets.isError && (
        <p role="alert" className="text-error">
          {message(presets.error)}
        </p>
      )}
      {presets.data && rows.length === 0 && <p className="text-muted-foreground">{t(projectId ? "home.emptyProject" : "home.empty")}</p>}
      {rows.length > 0 && (
        <Table data-testid="library-table">
          <TableHeader>
            <TableRow>
              <TableHead className="label-caps">{t("columns.name")}</TableHead>
              <TableHead className="label-caps">{t("columns.layer")}</TableHead>
              <TableHead className="label-caps">{t("columns.basedOn")}</TableHead>
              <TableHead className="label-caps">{t("columns.version")}</TableHead>
              <TableHead className="label-caps">{t("columns.edited")}</TableHead>
              <TableHead className="label-caps text-right">{t("columns.usedBy")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} data-testid="library-row" data-preset={p.id} data-name={p.name}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link href={presetHref(org.slug, p)} className="hover:underline">
                      {p.name}
                    </Link>
                    {p.starred && <Tag title={t("preset.starredHint")}>{t("preset.starred")}</Tag>}
                    {p.archived && <Tag>{t("preset.archived")}</Tag>}
                    {p.available === false && <Tag>{t("preset.unavailable")}</Tag>}
                  </div>
                </TableCell>
                <TableCell>
                  <Tag className={p.layer === "system" ? "text-muted-foreground" : undefined}>{t(`layers.${p.layer}`)}</Tag>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.basedOn}</TableCell>
                <TableCell className="tabular-nums">
                  <span className="flex items-center gap-2">
                    {p.latestPublishedVersion ? t("preset.versionN", { n: p.latestPublishedVersion.number ?? 0 }) : <span className="text-muted-foreground">{t("preset.unpublished")}</span>}
                    {p.draft && <Tag data-testid="draft-tag">{p.draft.problemCount ? t("preset.draftProblems", { n: p.draft.problemCount }) : t("preset.draft")}</Tag>}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.layer === "system" ? null : (
                    <span className="tabular-nums">
                      {p.updatedBy ? t("preset.editedBy", { name: p.updatedBy.name, when: p.updatedAt ? relativeTime(p.updatedAt) : "" }) : p.updatedAt ? relativeTime(p.updatedAt) : null}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{p.usedByCount ?? 0}</TableCell>
                <TableCell className="text-right">
                  {canCreate && p.layer === "system" && p.latestPublishedVersion && (
                    <Button variant="outline" size="sm" render={<Link href={createHref(org.slug, p.kind, { mode: "copy", from: p.latestPublishedVersion.id, projectId })} />} nativeButton={false} data-testid="make-copy">
                      {t("preset.makeCopy")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

/** The firm's own presets first, then the system's. */
const layerOrder = (p: Preset) => (p.layer === "project" ? 0 : p.layer === "org" ? 1 : 2);
