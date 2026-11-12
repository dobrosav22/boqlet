/**
 * Object storage emulation (mock-api.md "Blobs"): files under `<dataDir>/blobs/<key>`, reached
 * through signed URLs `http://localhost:4010/_blobs/<key>?method=&exp=&sig=`, like presigned S3 URLs.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { now } from "./clock.js";
import { dataDir } from "./paths.js";

const SECRET = process.env.MOCK_BLOB_SECRET ?? "boqlet-mock-blob-secret";
export const publicBaseUrl = () => process.env.MOCK_PUBLIC_URL ?? `http://localhost:${process.env.MOCK_PORT ?? 4010}`;

export function blobPath(key: string) {
  const root = path.resolve(dataDir(), "blobs");
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error(`bad blob key ${key}`);
  return full;
}

const sign = (key: string, method: string, exp: number) =>
  createHmac("sha256", SECRET).update(`${method}\n${key}\n${exp}`).digest("hex");

export function signedUrl(key: string, method: "GET" | "PUT", ttlSeconds = 3600) {
  const exp = Math.floor(now().getTime() / 1000) + ttlSeconds;
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  const url = `${publicBaseUrl()}/_blobs/${encoded}?method=${method}&exp=${exp}&sig=${sign(key, method, exp)}`;
  return { url, expiresAt: new Date(exp * 1000).toISOString() };
}

export function verifySignature(key: string, method: string, exp?: string, sig?: string): "ok" | "expired" | "invalid" {
  if (!exp || !sig) return "invalid";
  const expected = Buffer.from(sign(key, method, Number(exp)));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "invalid";
  return Number(exp) * 1000 < now().getTime() ? "expired" : "ok";
}

export async function putBlob(key: string, data: Uint8Array) {
  const file = blobPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
}
export const getBlob = (key: string) => readFile(blobPath(key));
export const blobExists = (key: string) =>
  stat(blobPath(key)).then(
    () => true,
    () => false,
  );
