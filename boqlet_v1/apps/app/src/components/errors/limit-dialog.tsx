"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ApiError } from "@/api/errors";
import { registerGlobalErrorHandler } from "@/api/global-errors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Shown when the API answers 402 (a plan limit, F14). FE-035 adds the upgrade path; until then it
 * says what was reached.
 */
export function LimitDialog() {
  const t = useTranslations();
  const [error, setError] = useState<ApiError | null>(null);
  useEffect(() => registerGlobalErrorHandler("limitReached", setError), []);
  // 402 details (conventions.md): which limit, the current count and the plan maximum.
  const limit = error?.details?.limit;
  const current = error?.details?.current;
  const max = error?.details?.max;
  return (
    <Dialog open={error !== null} onOpenChange={(open) => !open && setError(null)}>
      <DialogContent data-testid="limit-dialog">
        <DialogHeader>
          <DialogTitle>{t("errors.limit.title")}</DialogTitle>
          <DialogDescription>{t("errors.limit.body")}</DialogDescription>
        </DialogHeader>
        {limit !== undefined && current !== undefined && max !== undefined && (
          <p className="text-ui" data-testid="limit-detail">
            {t("errors.limit.detail", { limit: String(limit), current: Number(current), max: Number(max) })}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button />}>{t("common.ok")}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
