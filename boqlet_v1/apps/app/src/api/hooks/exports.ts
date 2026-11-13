"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/api/client";
import { localJobs } from "@/realtime/local-jobs";

/** How often an export job is asked about while it runs (exports take seconds, F12). */
const POLL_MS = 500;
const TIMEOUT_MS = 120_000;

/** Hands a file to the browser as a download. */
export function saveFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * F12: a run's BoQ Excel. Starts the `export_xlsx` job, waits for it (SSE also announces it; asking
 * keeps this independent of the event stream), then downloads the file through the signed URL.
 */
export function useExportRun(runId: string) {
  return useMutation({
    mutationFn: async ({ groupBy }: { groupBy?: string | null }) => {
      const job = (await api.POST("/runs/{runId}/exports", { params: { path: { runId } }, body: { format: "xlsx", ...(groupBy ? { groupBy } : {}) } })).data!;
      localJobs.add(job.id);
      const deadline = Date.now() + TIMEOUT_MS;
      let current = job;
      while (current.status === "queued" || current.status === "running") {
        if (Date.now() > deadline) throw new Error("export timed out");
        await new Promise((r) => setTimeout(r, POLL_MS));
        current = (await api.GET("/jobs/{jobId}", { params: { path: { jobId: job.id } } })).data!;
      }
      if (current.status !== "succeeded") throw Object.assign(new Error(current.error?.message ?? "export failed"), { code: current.error?.code });
      const exportId = (current.output as { exportId?: string } | undefined)?.exportId;
      if (!exportId) throw new Error("export without a file");
      const meta = (await api.GET("/exports/{exportId}", { params: { path: { exportId } } })).data!;
      const blob = (await api.GET("/exports/{exportId}/download", { params: { path: { exportId } }, parseAs: "blob" })).data as unknown as Blob;
      saveFile(blob, meta.fileName);
      return meta;
    },
  });
}
