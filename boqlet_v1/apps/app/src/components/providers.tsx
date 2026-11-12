"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { registerGlobalErrorHandler } from "@/api/global-errors";
import { makeQueryClient } from "@/api/query-client";
import { LimitDialog } from "@/components/errors/limit-dialog";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Toaster } from "@/components/ui/sonner";

/** Providers of the signed-in app: the query cache, toasts, and the global error handlers. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  const t = useTranslations("errors");
  const message = useErrorMessage();

  useEffect(() => {
    const offs = [
      registerGlobalErrorHandler("conflict", () => toast(t("conflict"))),
      registerGlobalErrorHandler("failed", (error) => toast.error(message(error))),
    ];
    return () => offs.forEach((off) => off());
  }, [t, message]);

  return (
    <QueryClientProvider client={client}>
      {children}
      <LimitDialog />
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}
