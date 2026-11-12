import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers";

/** The signed-in app: query cache and global error handling. FE-004 adds the auth gate and SSE. */
export default function SignedInLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
