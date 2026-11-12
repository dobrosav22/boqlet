import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers";

/** Public pages (sign-in, invitations, share links): the query cache and toasts, no auth gate. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
