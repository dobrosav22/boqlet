import { Suspense, type ReactNode } from "react";
import { AuthGate } from "@/auth/auth-gate";
import { AppProviders } from "@/components/providers";
import { AdminShell } from "@/features/admin/admin-shell";

/** The platform admin console (F19, S36) has its own layout, outside the org chrome. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <Suspense>
        <AuthGate>
          <AdminShell>{children}</AdminShell>
        </AuthGate>
      </Suspense>
    </AppProviders>
  );
}
