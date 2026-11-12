import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { OrgProvider } from "@/features/orgs/org-context";

/** Org chrome: the org is resolved by slug from `GET /me`; orgs the user isn't in show 404. */
export default async function OrgLayout({ children, params }: { children: ReactNode; params: Promise<{ org: string }> }) {
  const { org } = await params;
  return (
    <OrgProvider slug={org}>
      <AppShell org={org}>{children}</AppShell>
    </OrgProvider>
  );
}
