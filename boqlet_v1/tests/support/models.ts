import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { client } from "./env";
import type { TestUser } from "./users";

export const DUPLEX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures", "ifc", "Ifc2x3_Duplex_Architecture.ifc");

/** Registers a version, PUTs the bytes to the signed URL, completes the upload (F03 §2). */
export async function uploadVersion(u: TestUser, modelId: string, bytes: Uint8Array, fileName: string) {
  const created = await client(u.token).POST("/models/{modelId}/versions", { params: { path: { modelId } }, body: { fileName, sizeBytes: bytes.byteLength } });
  expect(created.response.status).toBe(201);
  const { version, upload } = created.data!;
  const put = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: new Blob([bytes as BlobPart]) });
  expect(put.ok).toBe(true);
  const done = await client(u.token).POST("/model-versions/{versionId}/complete", { params: { path: { versionId: version.id } }, body: {} });
  expect(done.response.status).toBe(200);
  return done.data!;
}

export const duplexBytes = async () => new Uint8Array(await readFile(DUPLEX));

/** Polls a version until it leaves queued/processing (the parse is a background job). */
export async function waitForVersion(u: TestUser, versionId: string, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { data } = await client(u.token).GET("/model-versions/{versionId}", { params: { path: { versionId } } });
    if (data && data.status !== "queued" && data.status !== "processing" && data.status !== "awaiting_upload") return data;
    if (Date.now() > deadline) throw new Error(`version ${versionId} still ${data?.status}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}
