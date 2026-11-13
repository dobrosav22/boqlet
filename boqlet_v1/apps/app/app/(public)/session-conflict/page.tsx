"use client";

import { Suspense } from "react";
import { SessionConflict } from "@/auth/session-conflict";

/** S31: the takeover question when the account is open on another device (F01 §10). */
export default function SessionConflictPage() {
  return (
    <Suspense>
      <SessionConflict />
    </Suspense>
  );
}
