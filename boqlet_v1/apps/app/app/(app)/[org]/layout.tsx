import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";

/** Org chrome. FE-005 resolves the org by slug from `GET /me` and 404s for orgs the user isn't in. */
export default async function OrgLayout({ children, params }: { children: ReactNode; params: Promise<{ org: string }> }) {
  const { org } = await params;
  return <AppShell org={org}>{children}</AppShell>;
}
