"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { CreatePreset } from "@/features/library/create-preset";
import { isLibraryKind } from "@/features/library/kinds";

/** S20 "new": create a preset of a kind (F10 §2). */
export default function NewPresetPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = use(params);
  if (!isLibraryKind(kind)) notFound();
  return <CreatePreset kind={kind} />;
}
