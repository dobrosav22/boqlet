/**
 * The one door to computation (mock-api.md "Engine"). Phase 1: `PocEngine` over the
 * proof-of-concept engine API (`engine/ifc_boq/api.py`, port 8787) plus the fakes in `./fakes`
 * (each listed in mock-api.md "Engine fakes" with the task that replaces it). Phase 2 swaps in a
 * `WorkerEngine` over the worker's HTTP transport (EN-001) behind this same interface.
 *
 * The mock never measures (BR-01): every quantity comes from the engine.
 */
import { openAsBlob } from "node:fs";
import path from "node:path";
import type { BoqResult } from "@ifc-boq/types";

export type PresetFolder = "rules" | "dictionaries" | "classifications" | "federation" | "resolution";

export interface ParsedModelSummary {
  modelId: string;
  fileName?: string;
  schema?: string;
  elementCount?: number;
  cached?: boolean;
  [key: string]: unknown;
}

export interface RunInput {
  models: { modelId: string; discipline?: string; scope?: Record<string, unknown> }[];
  /** Engine preset ids (the mock saves resolved preset versions under `mock-<versionId>`). */
  ruleSet: string;
  dictionaries: string[];
  classifications: string[];
  decisions: { questionId: string; answer: unknown; [key: string]: unknown }[];
}

export interface RunOutput {
  runId: string;
  result: BoqResult;
}

export interface Engine {
  readonly name: string;
  health(): Promise<{ ok: boolean; version?: string }>;
  parseModel(file: { path: string; name?: string }): Promise<ParsedModelSummary>;
  run(input: RunInput): Promise<RunOutput>;
  savePreset(kind: PresetFolder, id: string, doc: unknown): Promise<void>;
  deletePreset(kind: PresetFolder, id: string): Promise<void>;
  checkPreset(kind: PresetFolder, doc: unknown, library?: unknown[]): Promise<{ ok: boolean; problems: string[] }>;
}

export class EngineUnavailable extends Error {}
export class EngineRefused extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Phase 1: the proof-of-concept engine API. Dropped when EN-001 lands (FE-046 deletes the API). */
export class PocEngine implements Engine {
  readonly name = "poc";
  constructor(private readonly baseUrl = process.env.POC_ENGINE_URL ?? `http://127.0.0.1:${process.env.IFC_BOQ_ENGINE_PORT ?? 8787}`) {}

  private async call<T>(method: string, route: string, body?: BodyInit, json = true): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.baseUrl + route, {
        method,
        body,
        headers: json && body ? { "Content-Type": "application/json" } : undefined,
      });
    } catch (e) {
      throw new EngineUnavailable(`engine not reachable at ${this.baseUrl}: ${(e as Error).message}`);
    }
    if (!res.ok) {
      let detail = res.statusText;
      try {
        detail = ((await res.json()) as { detail?: string }).detail ?? detail;
      } catch {
        /* not JSON */
      }
      throw new EngineRefused(res.status, String(detail));
    }
    return (await res.json()) as T;
  }

  health() {
    return this.call<{ ok: boolean; version?: string }>("GET", "/api/health");
  }

  async parseModel(file: { path: string; name?: string }) {
    const form = new FormData();
    form.append("file", await openAsBlob(file.path), file.name ?? path.basename(file.path));
    return this.call<ParsedModelSummary>("POST", "/api/models", form, false);
  }

  run(input: RunInput) {
    return this.call<RunOutput>("POST", "/api/runs", JSON.stringify(input));
  }

  async savePreset(kind: PresetFolder, id: string, doc: unknown) {
    await this.call("PUT", `/api/presets/${kind}/${encodeURIComponent(id)}`, JSON.stringify({ doc }));
  }

  async deletePreset(kind: PresetFolder, id: string) {
    await this.call("DELETE", `/api/presets/${kind}/${encodeURIComponent(id)}`);
  }

  checkPreset(kind: PresetFolder, doc: unknown, library: unknown[] = []) {
    return this.call<{ ok: boolean; problems: string[] }>("POST", `/api/presets/${kind}/check`, JSON.stringify({ doc, library }));
  }
}

let current: Engine = new PocEngine();
export const engine = () => current;
/** Tests replace the engine (e.g. with a recorded one). */
export function setEngine(next: Engine) {
  current = next;
}
