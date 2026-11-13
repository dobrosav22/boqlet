"use client";

import { use } from "react";
import { PresetPage } from "@/features/library/preset-page";

/** S20: one preset: its draft, versions and where it is used (F10 §3, 5, 9, 10). */
export default function LibraryPresetPage({ params }: { params: Promise<{ kind: string; presetId: string }> }) {
  const { presetId } = use(params);
  return <PresetPage presetId={presetId} />;
}
