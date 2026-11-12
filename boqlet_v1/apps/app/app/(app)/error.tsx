"use client";

import { ErrorView } from "@/components/errors/error-view";

export default function SignedInError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-8">
      <ErrorView error={error} reset={reset} />
    </main>
  );
}
