"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { isApiError } from "@/api/errors";

/** The translated text for an error: `errors.codes.<code>` when the catalogue has it, else generic. */
export function useErrorMessage() {
  const t = useTranslations("errors");
  return useCallback(
    (error: unknown) => {
      if (!isApiError(error)) return t("generic");
      if (error.status === 0) return t("network");
      const key = `codes.${error.code}`;
      return t.has(key) ? t(key) : t("generic");
    },
    [t],
  );
}
