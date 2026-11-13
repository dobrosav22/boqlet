"use client";

import { createContext, useContext } from "react";
import type { PreviewResult } from "@/api/hooks/library";

/**
 * The latest preview of the preset being edited (F10 §6), for editors that show samples from it: an
 * item text's "Reads as" with a line's values (F10 §13). null until a preview has run.
 */
export const PreviewResultContext = createContext<PreviewResult | null>(null);

export const usePreviewResult = () => useContext(PreviewResultContext);
