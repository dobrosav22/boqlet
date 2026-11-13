"use client";

import { PublicSharePage } from "@/features/shares/public-share";

export function PublicShareRoute({ token }: { token: string }) {
  return <PublicSharePage token={token} />;
}
