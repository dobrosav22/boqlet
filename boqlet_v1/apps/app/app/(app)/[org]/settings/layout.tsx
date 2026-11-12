import type { ReactNode } from "react";
import { SettingsNav } from "@/features/settings/settings-nav";

/** Org settings (S21–S25): a sub-navigation and the section. Billing, usage, audit follow (FE-033, FE-035). */
export default async function SettingsLayout({ children, params }: { children: ReactNode; params: Promise<{ org: string }> }) {
  const { org } = await params;
  return (
    <div className="flex flex-col gap-6">
      <SettingsNav org={org} />
      {children}
    </div>
  );
}
