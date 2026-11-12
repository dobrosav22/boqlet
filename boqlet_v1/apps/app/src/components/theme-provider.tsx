"use client";

import type { ReactNode } from "react";
import { ThemeProvider as NextThemes } from "next-themes";

/** Light by default; dark when the OS asks for it, or when the user switches (design-guidelines.md). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="boqlet-theme">
      {children}
    </NextThemes>
  );
}
