import type { ReactNode } from "react";
import { AppProviders } from "@/components/providers";

/** The platform admin console (F19) has its own layout, outside the org chrome. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
