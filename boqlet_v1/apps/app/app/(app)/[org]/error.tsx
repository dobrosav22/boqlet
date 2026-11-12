"use client";

import { ErrorView } from "@/components/errors/error-view";

export default function OrgError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorView error={error} reset={reset} />;
}
