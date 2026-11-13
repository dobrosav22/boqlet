import type { Metadata } from "next";
import { PublicShareRoute } from "./route-client";

/** S35: a public share link (F18). Never indexed; the referrer is never sent (headers in next.config.ts). */
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function PublicSharePageRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicShareRoute token={token} />;
}
