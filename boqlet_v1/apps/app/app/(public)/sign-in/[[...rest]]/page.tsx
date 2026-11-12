"use client";

import { Suspense } from "react";
import { authAdapter } from "@/auth";

/** S01: the adapter's sign-in page (the mock lists the seeded users). */
export default function SignInPage() {
  const Page = authAdapter.SignInPage;
  return <Suspense>{Page ? <Page /> : null}</Suspense>;
}
