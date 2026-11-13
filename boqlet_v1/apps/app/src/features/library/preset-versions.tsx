"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { usePresetVersion, usePresetVersions, useSaveDraft, type Preset, type PresetVersionInfo } from "@/api/hooks/library";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DocumentView } from "./document-view";
import { diffDocs } from "./json-diff";

/**
 * Versions (F10 §5): the history (number, note, by, at), any version read-only (`?version=`), two
 * versions compared as a JSON diff (`?compare=a,b`), and "Restore as draft" for editors.
 */
export function PresetVersions({ preset, editable }: { preset: Preset; editable: boolean }) {
  const t = useTranslations("library");
  const format = useFormatter();
  const message = useErrorMessage();
  const versions = usePresetVersions(preset.id);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const viewing = params.get("version");
  const compare = params.get("compare")?.split(",").filter(Boolean) ?? [];
  const [picked, setPicked] = useState<string[]>([]);
  const go = (q: Record<string, string>) => router.replace(`${pathname}?${new URLSearchParams({ tab: "versions", ...q })}`, { scroll: false });

  if (versions.isError) {
    return (
      <p role="alert" className="text-error">
        {message(versions.error)}
      </p>
    );
  }
  const list = versions.data ?? [];
  const label = (v: PresetVersionInfo) => (v.status === "draft" ? t("preset.draft") : t("preset.versionN", { n: v.number ?? 0 }));
  // Older first: drafts are the newest.
  const rank = (id: string) => {
    const v = list.find((x) => x.id === id);
    return v?.number ?? Number.MAX_SAFE_INTEGER;
  };
  const ordered = [...picked].sort((a, b) => rank(a) - rank(b));
  return (
    <div className="flex flex-col gap-4" data-testid="preset-versions">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-muted-foreground">{t("versions.hint")}</p>
        <Button variant="outline" disabled={picked.length !== 2} onClick={() => go({ compare: ordered.join(",") })} data-testid="compare-versions">
          {t("versions.compare")}
        </Button>
      </div>
      {versions.data && list.length === 0 && <p className="text-muted-foreground">{t("versions.none")}</p>}
      {list.length > 0 && (
        <Table data-testid="versions-table">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <span className="sr-only">{t("versions.pick")}</span>
              </TableHead>
              <TableHead className="label-caps">{t("versions.version")}</TableHead>
              <TableHead className="label-caps">{t("versions.note")}</TableHead>
              <TableHead className="label-caps">{t("versions.by")}</TableHead>
              <TableHead className="label-caps">{t("versions.at")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((v) => (
              <TableRow key={v.id} data-testid="version-row" data-version={v.id} className={cn(viewing === v.id && "bg-muted")}>
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={t("versions.pickOne", { version: label(v) })}
                    checked={picked.includes(v.id)}
                    onChange={(e) => setPicked((p) => (e.target.checked ? [...p, v.id].slice(-2) : p.filter((x) => x !== v.id)))}
                    data-testid="version-pick"
                  />
                </TableCell>
                <TableCell className="tabular-nums">
                  {label(v)}
                  {v.problemCount ? <span className="ml-2 text-error">{t("preset.problems", { n: v.problemCount })}</span> : null}
                </TableCell>
                <TableCell>{v.changeNote}</TableCell>
                <TableCell className="text-muted-foreground">{v.publishedBy?.name}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{v.publishedAt || v.updatedAt ? format.dateTime(new Date((v.publishedAt ?? v.updatedAt)!), { dateStyle: "medium", timeStyle: "short" }) : null}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => go({ version: v.id })} data-testid="view-version">
                    {t("versions.view")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {compare.length === 2 && <VersionDiff preset={preset} older={compare[0]!} newer={compare[1]!} label={(id) => { const v = list.find((x) => x.id === id); return v ? label(v) : ""; }} />}
      {viewing && compare.length !== 2 && <VersionView preset={preset} versionId={viewing} editable={editable} etag={list.find((v) => v.id === viewing)?.etag} />}
    </div>
  );
}

function VersionView({ preset, versionId, editable, etag }: { preset: Preset; versionId: string; editable: boolean; etag?: string }) {
  const t = useTranslations("library");
  const version = usePresetVersion(versionId, etag);
  const restore = useSaveDraft(preset.id);
  if (!version.data) return <div aria-busy="true" />;
  const v = version.data;
  const restorable = editable && v.status === "published";
  const doRestore = async () => {
    await restore.mutateAsync({ doc: v.doc });
    toast(t("versions.restored", { n: v.number ?? 0 }));
  };
  return (
    <section className="flex flex-col gap-3" data-testid="version-view" data-version={v.id}>
      <div className="flex items-center gap-3">
        <h2 className="label-caps flex-1">{v.status === "draft" ? t("preset.draft") : t("preset.versionN", { n: v.number ?? 0 })}</h2>
        {restorable &&
          (preset.draft ? (
            <ConfirmDialog
              trigger={<Button variant="outline" data-testid="restore-version" />}
              title={t("versions.restoreTitle", { n: v.number ?? 0 })}
              body={t("versions.restoreBody", { n: v.number ?? 0 })}
              confirm={t("versions.restore")}
              testId="restore-version-confirm"
              onConfirm={doRestore}
            />
          ) : (
            <Button variant="outline" onClick={() => void doRestore().catch(() => {})} disabled={restore.isPending} data-testid="restore-version">
              {t("versions.restore")}
            </Button>
          ))}
      </div>
      {v.status === "published" && <p className="text-muted-foreground">{t("versions.readOnly")}</p>}
      <DocumentView doc={v.doc} fileName={`${preset.slug}-${v.number ?? "draft"}.json`} />
    </section>
  );
}

function VersionDiff({ preset, older, newer, label }: { preset: Preset; older: string; newer: string; label: (id: string) => string }) {
  const t = useTranslations("library.versions");
  const etags = new Map([[preset.draft?.id, preset.draft?.etag]]);
  const a = usePresetVersion(older, etags.get(older));
  const b = usePresetVersion(newer, etags.get(newer));
  if (!a.data || !b.data) return <div aria-busy="true" />;
  const { rows, added, removed } = diffDocs(a.data.doc, b.data.doc);
  return (
    <section className="flex flex-col gap-3" data-testid="version-diff">
      <h2 className="label-caps">{t("diffTitle", { older: label(older), newer: label(newer) })}</h2>
      <p className="text-muted-foreground" data-testid="diff-summary">
        {added + removed === 0 ? t("diffSame") : t("diffSummary", { added, removed })}
      </p>
      {added + removed > 0 && (
        <div className="max-h-[60vh] overflow-auto rounded-[var(--radius)] border border-border text-ui">
          <table className="w-full border-collapse font-mono">
            <tbody>
              {rows.map((r, i) =>
                r.op === "skip" ? (
                  <tr key={i} className="text-muted-foreground">
                    <td colSpan={4} className="bg-muted px-2">
                      {t("diffSkip", { n: r.count })}
                    </td>
                  </tr>
                ) : (
                  <tr key={i} data-op={r.op} className={cn(r.op === "added" && "bg-link/10", r.op === "removed" && "bg-error/10")}>
                    <td className="w-12 pr-2 text-right text-muted-foreground tabular-nums select-none">{r.a ?? ""}</td>
                    <td className="w-12 pr-2 text-right text-muted-foreground tabular-nums select-none">{r.b ?? ""}</td>
                    <td className="w-4 select-none">{r.op === "added" ? "+" : r.op === "removed" ? "−" : ""}</td>
                    <td className="whitespace-pre">{r.text}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
