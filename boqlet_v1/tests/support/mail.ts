import { ROOT_URL, TARGET } from "./env";

/**
 * Emails the backend sent (invitations carry their token only by email). Mock: its outbox at
 * `/_dev/outbox`. Java needs an equivalent test-only mail sink (noted for the backend agent).
 */
export interface SentMail {
  to: string;
  subject: string;
  kind: string;
  links: string[];
}

export async function mailsTo(email: string): Promise<SentMail[]> {
  if (TARGET !== "mock") throw new Error(`no mail sink for target ${TARGET} yet`);
  const res = await fetch(`${ROOT_URL}/_dev/outbox`);
  return ((await res.json()) as SentMail[]).filter((m) => m.to.toLowerCase() === email.toLowerCase());
}

/** The token of the newest invitation sent to `email` (from its `/invite/<token>` link). */
export async function invitationToken(email: string): Promise<string> {
  const link = (await mailsTo(email)).flatMap((m) => m.links).find((l) => l.includes("/invite/"));
  if (!link) throw new Error(`no invitation mail to ${email}`);
  return link.split("/invite/")[1]!;
}
