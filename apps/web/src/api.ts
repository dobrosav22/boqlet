/**
 * Thin client for the engine service (engine/ifc_boq/api.py).
 * The contract lives in @ifc-boq/types (api.ts); keep this file free of UI logic.
 */
import type { ApiError, ModelSummary, PresetsResponse, RunRequest, RunResponse } from "@ifc-boq/types";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    throw new Error("The engine is not reachable. Start it with `npm run dev` (it runs on port 8787).");
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as ApiError;
      if (body.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* not JSON */
    }
    if (res.status === 502 || res.status === 504) detail = "The engine is not running. Start it with `npm run dev`.";
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export const api = {
  presets: () => call<PresetsResponse>("/api/presets"),
  preset: (kind: "rules" | "dictionaries" | "classifications", id: string) =>
    call<unknown>(`/api/presets/${kind}/${encodeURIComponent(id)}`),
  uploadModel: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return call<ModelSummary>("/api/models", { method: "POST", body });
  },
  run: (req: RunRequest) =>
    call<RunResponse>("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }),
};
