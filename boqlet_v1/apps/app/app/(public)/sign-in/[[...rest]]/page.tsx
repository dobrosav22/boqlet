"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { authAdapter } from "@/auth";

/** S01: the adapter's sign-in page (the mock lists the seeded users), and why one was signed out (F01 §10). */
export default function SignInPage() {
  const Page = authAdapter.SignInPage;
  return (
    <Suspense>
      <SignedOutNotice />
      {Page ? <Page /> : null}
    </Suspense>
  );
}

function SignedOutNotice() {
  const t = useTranslations("auth.signedOut");
  const reason = useSearchParams().get("reason");
  if (!reason || !t.has(reason)) return null;
  return (
    <p role="status" className="mx-auto mt-8 max-w-xl border-l-2 border-[var(--status-attention)] px-8 py-2" data-testid="signed-out-reason">
      {t(reason)}
    </p>
  );
}
