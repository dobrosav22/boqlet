"use client";

import { useState } from "react";
import { useMutation, useQueries } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "next-intl";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import type { Boq } from "@/api/hooks/boqs";
import { useRevisions } from "@/api/hooks/diffs";
import { saveFile, useExportRun } from "@/api/hooks/exports";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditsImport } from "./edits-import";

type Export = Schemas["Export"];

/**
 * S12g (F12): exports of this BoQ. The working version's Excel on demand (grouped by a chosen
 * classification, WORKING in its title), and the files frozen with each saved version (BR-25: always
 * the same file), with the change reports written from the Changes tab. Downloads go through the API.
 */
export function ExportsTab({ boq }: { boq: Boq }) {
  const t = useTranslations("boqs.exports");
  const format = useFormatter();
  const message = useErrorMessage();
  const revisions = useRevisions(boq.id);
  const list = revisions.data ?? [];
  const lists = useQueries({
    queries: list.map((r) => ({
      queryKey: keys.revisionExports(r.id),
      queryFn: async () => (await api.GET("/revisions/{revisionId}/exports", { params: { path: { revisionId: r.id } } })).data!,
    })),
  });
  const run = boq.currentRevision.currentRun;
  const systems = run?.classifications ?? [];
  const [groupBy, setGroupBy] = useState<string | null>(systems[0]?.id ?? null);
  const exporting = useExportRun(run?.id ?? "");
  const download = useMutation({
    mutationFn: async (e: Export) => {
      const blob = (await api.GET("/exports/{exportId}/download", { params: { path: { exportId: e.id } }, parseAs: "blob" })).data as unknown as Blob;
      saveFile(blob, e.fileName);
    },
    onError: () => {},
  });
  const working = boq.status === "working" ? boq.currentRevision : undefined;
  const exportExcel = () => {
    const id = toast.loading(t("exporting"));
    exporting.mutate({ groupBy }, { onSuccess: (e) => toast.success(t("exported", { file: e.fileName }), { id }), onError: (err) => toast.error(message(err), { id }) });
  };

  return (
    <div className="flex flex-col gap-8" data-testid="exports-tab">
      {working && (
        <section className="flex flex-col gap-3">
          <h3 className="label-caps">{t("working", { label: working.label })}</h3>
          <p className="text-muted-foreground">{t("workingHint")}</p>
          <div className="flex flex-wrap items-end gap-3">
            {systems.length > 1 && (
              <label className="flex flex-col gap-1">
                <span className="label-caps text-muted-foreground">{t("groupBy")}</span>
                <NativeSelect value={groupBy ?? ""} onChange={(e) => setGroupBy(e.target.value || null)} data-testid="exports-group-by">
                  {systems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            )}
            <Button onClick={exportExcel} disabled={!run || exporting.isPending} data-testid="exports-new">
              <Download aria-hidden />
              {t("excel")}
            </Button>
          </div>
        </section>
      )}
      {working && working.permissions.editLines && working.currentRun && <EditsImport boq={boq} />}
      {list.map((r, i) => {
        const files = lists[i]?.data ?? [];
        if (r.status !== "issued" && files.length === 0) return null;
        return (
          <section key={r.id} className="flex flex-col gap-3" data-testid="exports-revision" data-label={r.label} data-status={r.status}>
            <h3 className="label-caps">{r.status === "issued" ? t("saved", { label: r.label }) : t("workingFiles", { label: r.label })}</h3>
            {files.length === 0 ? (
              <p className="text-muted-foreground">{t("none")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="label-caps">{t("file")}</TableHead>
                    <TableHead className="label-caps">{t("kind")}</TableHead>
                    <TableHead className="label-caps">{t("by")}</TableHead>
                    <TableHead className="label-caps">{t("when")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((e) => (
                    <TableRow key={e.id} data-testid="export-row" data-kind={e.kind}>
                      <TableCell className="max-w-[420px] truncate" title={e.fileName}>
                        {e.fileName}
                      </TableCell>
                      <TableCell>{t.has(`kinds.${e.kind}`) ? t(`kinds.${e.kind}`) : e.kind}</TableCell>
                      <TableCell>{e.createdBy?.name}</TableCell>
                      <TableCell className="tabular-nums">{format.dateTime(new Date(e.createdAt), { dateStyle: "medium", timeStyle: "short" })}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => download.mutate(e)} disabled={download.isPending} data-testid="export-download">
                          <Download aria-hidden />
                          {t("download")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        );
      })}
      {download.error ? (
        <p role="alert" className="text-error">
          {message(download.error)}
        </p>
      ) : null}
    </div>
  );
}
