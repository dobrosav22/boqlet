"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMe } from "@/api/hooks/me";
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
 * Shown when the API answers 402 (a plan limit, F14): which limit, current and maximum, and the way
 * on: "Upgrade" (the owner, to the billing page) or "Ask your owner" (everyone else).
 */
export function LimitDialog() {
  const t = useTranslations();
  const [error, setError] = useState<ApiError | null>(null);
  const me = useMe();
  // The org is the first path segment of the page the limit was hit on.
  const slug = usePathname().split("/")[1] ?? "";
  const membership = me.data?.memberships.find((m) => m.org.slug === slug);
  const owner = membership?.role === "owner";
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
        {membership && !owner && <p className="text-ui text-muted-foreground" data-testid="limit-ask-owner">{t("errors.limit.askOwner")}</p>}
        <DialogFooter>
          {owner ? (
            <>
              <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
              <Button render={<Link href={`/${slug}/settings/billing`} />} nativeButton={false} onClick={() => setError(null)} data-testid="limit-upgrade">
                {t("errors.limit.upgrade")}
              </Button>
            </>
          ) : (
            <DialogClose render={<Button />}>{t("common.ok")}</DialogClose>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
