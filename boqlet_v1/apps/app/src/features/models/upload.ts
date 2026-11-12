import { api } from "@/api/client";
import { ApiError } from "@/api/errors";

/** Client-side checks before anything is sent (F03 §2.1, F03-AC6). */
export function checkFile(file: File, maxMb: number | undefined): "not_ifc" | "too_large" | null {
  if (!/\.ifc$/i.test(file.name)) return "not_ifc";
  if (maxMb !== undefined && file.size > maxMb * 1024 * 1024) return "too_large";
  return null;
}

/** PUT to a signed URL with upload progress (fetch has no upload progress, so XHR). */
function putWithProgress(url: string, headers: Record<string, string>, file: File, onProgress: (share: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new ApiError(xhr.status, "upload_failed", xhr.statusText)));
    xhr.onerror = () => reject(ApiError.network(new Error("upload failed")));
    xhr.send(file);
  });
}

/**
 * Upload a model version (F03 §2): register it, PUT the file straight to storage, complete. The
 * parse then runs in the background; follow it through SSE (`job.progress`).
 */
export async function uploadModelVersion(modelId: string, file: File, onProgress: (share: number) => void, note?: string) {
  const created = (
    await api.POST("/models/{modelId}/versions", { params: { path: { modelId } }, body: { fileName: file.name, sizeBytes: file.size, ...(note ? { note } : {}) } })
  ).data!;
  await putWithProgress(created.upload.url, created.upload.headers ?? {}, file, onProgress);
  onProgress(1);
  return (await api.POST("/model-versions/{versionId}/complete", { params: { path: { versionId: created.version.id } }, body: {} })).data!;
}
