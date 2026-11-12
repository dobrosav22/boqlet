"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/auth";

/** The signed-in part of the app: anonymous visitors go to sign-in and come back afterwards. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    if (status === "anonymous") {
      const returnTo = pathname + (search ? `?${search}` : "");
      router.replace(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [status, pathname, search, router]);

  if (status !== "authenticated") return <div className="min-h-dvh" aria-busy="true" />;
  return children;
}
