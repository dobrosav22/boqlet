import { Suspense, type ReactNode } from "react";
import { AuthGate } from "@/auth/auth-gate";
import { AppProviders } from "@/components/providers";
import { RealtimeProvider } from "@/realtime/realtime-provider";

/** The signed-in app: query cache, global error handling, the auth gate and the SSE connection. */
export default function SignedInLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <Suspense>
        <AuthGate>
          <RealtimeProvider>{children}</RealtimeProvider>
        </AuthGate>
      </Suspense>
    </AppProviders>
  );
}
