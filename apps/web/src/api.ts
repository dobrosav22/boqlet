/**
 * Thin client for the engine service (engine/ifc_boq/api.py).
 * The contract lives in @ifc-boq/types (api.ts); keep this file free of UI logic.
 */
import type {
  ApiError,
  CheckPresetRequest,
  CheckPresetResponse,
  CodeListBuildRequest,
  CodeListBuildResponse,
  ModelSummary,
  NamesRequest,
  NamesResponse,
  PresetsResponse,
  RunRequest,
  RunResponse,
  SavePresetResponse,
  SceneIndex,
  TableReadResponse,
} from "@ifc-boq/types";

/** Built for a hosted demo (vercel.json): no local engine to start, smaller uploads, a forgetful server. */
export const DEPLOYED = import.meta.env.VITE_DEPLOYED === "1";
/** Largest upload the host accepts, in MB; 0 = no limit set here (the engine has its own). */
export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB ?? 0) || 0;

const tooLarge = (name: string, size?: number) =>
  `${name} is ${size ? `${(size / (1 << 20)).toFixed(1)} MB` : "too large"}; this demo accepts files up to ${MAX_UPLOAD_MB} MB. Run the app locally for larger models.`;

function checkSize(file: File) {
  if (MAX_UPLOAD_MB && file.size > MAX_UPLOAD_MB * (1 << 20)) throw new Error(tooLarge(file.name, file.size));
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new Error(DEPLOYED ? "The engine did not answer. Try again in a moment." : "The engine is not reachable. Start it with `npm run dev` (it runs on port 8787).");
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as ApiError;
      if (body.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* not JSON */
    }
    if (res.status === 413 && MAX_UPLOAD_MB) detail = tooLarge("The file");
    else if (res.status === 502 || res.status === 504)
      detail = DEPLOYED ? "The engine took too long or stopped. Try again; very large models may not fit this demo." : "The engine is not running. Start it with `npm run dev`.";
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

/**
 * The files of the uploaded models, by model id. A hosted engine keeps parsed models only while its
 * instance lives; when it answers "model not found", the files are sent again (same content, same
 * id) and the request is repeated once.
 */
const uploaded = new Map<string, File>();
async function withModels<T>(ids: string[], request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (e) {
    const files = ids.map((id) => uploaded.get(id));
    if (!(e instanceof Error) || !/model not found|no geometry/i.test(e.message) || files.some((f) => !f)) throw e;
    for (const f of files) await upload(f!);
    return request();
  }
}

async function upload(file: File): Promise<ModelSummary> {
  checkSize(file);
  const body = new FormData();
  body.append("file", file);
  const m = await call<ModelSummary>("/api/models", { method: "POST", body });
  uploaded.set(m.modelId, file);
  return m;
}

export const api = {
  presets: () => call<PresetsResponse>("/api/presets"),
  preset: (kind: "rules" | "dictionaries" | "classifications", id: string) =>
    call<unknown>(`/api/presets/${kind}/${encodeURIComponent(id)}`),
  checkPreset: (kind: "rules" | "dictionaries" | "classifications", req: CheckPresetRequest) =>
    call<CheckPresetResponse>(`/api/presets/${kind}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }),
  /** Save a draft to presets/user (dev build); refused with problems, never for a shipped preset's id. */
  savePreset: (kind: "rules" | "dictionaries" | "classifications", id: string, doc: unknown) =>
    call<SavePresetResponse>(`/api/presets/${kind}/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc }),
    }),
  deletePreset: (kind: "rules" | "dictionaries" | "classifications", id: string) =>
    call<{ ok: boolean }>(`/api/presets/${kind}/${encodeURIComponent(id)}`, { method: "DELETE" }),
  names: (modelId: string, req: NamesRequest) =>
    withModels([modelId], () =>
      call<NamesResponse>(`/api/models/${encodeURIComponent(modelId)}/names`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      }),
    ),
  readCodeTable: (file: File) => {
    checkSize(file);
    const body = new FormData();
    body.append("file", file);
    return call<TableReadResponse>("/api/codelists/read", { method: "POST", body });
  },
  buildCodes: (req: CodeListBuildRequest) =>
    call<CodeListBuildResponse>("/api/codelists/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }),
  scene: (modelId: string) => withModels([modelId], () => call<SceneIndex>(`/api/models/${encodeURIComponent(modelId)}/scene`)),
  geometryUrl: (modelId: string) => `/api/models/${encodeURIComponent(modelId)}/geometry.glb`,
  uploadModel: upload,
  run: (req: RunRequest) =>
    withModels(req.models?.map((m) => m.modelId) ?? (req.modelId ? [req.modelId] : []), () =>
      call<RunResponse>("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      }),
    ),
  /** The Excel file of a run, or null when the engine no longer has it (a hosted engine forgets runs). */
  excel: async (url: string): Promise<Blob | null> => {
    try {
      const res = await fetch(url);
      return res.ok ? await res.blob() : null;
    } catch {
      return null;
    }
  },
};
