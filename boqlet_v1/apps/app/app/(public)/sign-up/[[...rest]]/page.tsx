"use client";

import { Suspense } from "react";
import { authAdapter } from "@/auth";

/** S01: the adapter's sign-up page (the mock's sign-in page holds its sign-up form). */
export default function SignUpPage() {
  const Page = authAdapter.SignUpPage ?? authAdapter.SignInPage;
  return <Suspense>{Page ? <Page /> : null}</Suspense>;
}
