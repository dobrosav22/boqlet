/** Email in the mock: written to `<dataDir>/outbox/*.html`, listed at `GET /_dev/outbox`. */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { nowIso } from "./clock.js";
import { dataDir } from "./paths.js";

export interface OutboxMail {
  id: string;
  to: string;
  subject: string;
  kind: string;
  sentAt: string;
  links: string[];
}

const dir = () => path.join(dataDir(), "outbox");

export function sendEmail(mail: { to: string; subject: string; kind: string; html: string }): OutboxMail {
  mkdirSync(dir(), { recursive: true });
  const sentAt = nowIso();
  const id = `${sentAt.replace(/[:.]/g, "-")}-${mail.kind}-${Math.random().toString(36).slice(2, 7)}`;
  const links = [...mail.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
  const meta: OutboxMail = { id, to: mail.to, subject: mail.subject, kind: mail.kind, sentAt, links };
  writeFileSync(path.join(dir(), `${id}.html`), mail.html);
  writeFileSync(path.join(dir(), `${id}.json`), JSON.stringify(meta, null, 1));
  return meta;
}

export function listOutbox(): OutboxMail[] {
  try {
    return readdirSync(dir())
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(readFileSync(path.join(dir(), f), "utf8")) as OutboxMail)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  } catch {
    return [];
  }
}

export function readOutboxHtml(id: string): string | null {
  if (!/^[\w-]+$/.test(id)) return null;
  try {
    return readFileSync(path.join(dir(), `${id}.html`), "utf8");
  } catch {
    return null;
  }
}
