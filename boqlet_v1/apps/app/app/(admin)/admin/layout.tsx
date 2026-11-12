import { Suspense, type ReactNode } from "react";
import { AuthGate } from "@/auth/auth-gate";
import { AppProviders } from "@/components/providers";

/** The platform admin console (F19) has its own layout, outside the org chrome. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <Suspense>
        <AuthGate>{children}</AuthGate>
      </Suspense>
    </AppProviders>
  );
}
