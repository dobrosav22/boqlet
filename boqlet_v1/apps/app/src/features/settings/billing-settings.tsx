"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useBilling, useCheckout, useEntitlements, usePortal, type Plan } from "@/api/hooks/billing";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/features/orgs/org-context";
import { cn } from "@/lib/utils";

/** The limits shown with usage bars, in this order (05-plans-and-limits.md). */
const METERED = ["seats", "activeProjects", "processingMinutesPerMonth"] as const;
const USAGE_OF: Record<(typeof METERED)[number], "seats" | "activeProjects" | "processingMinutesThisMonth"> = {
  seats: "seats",
  activeProjects: "activeProjects",
  processingMinutesPerMonth: "processingMinutesThisMonth",
};
/** Other limits listed on the plan cards. */
const LISTED = ["seats", "activeProjects", "maxModelVersionMb", "maxModelsPerBoq", "processingMinutesPerMonth", "approvalWorkflow", "exportWatermark"] as const;

/** S23 (owner): current plan, status, limits with usage, change plan (checkout), manage billing (portal). F14. */
export function BillingSettings() {
  const t = useTranslations("settings.billing");
  const format = useFormatter();
  const message = useErrorMessage();
  const { org, can } = useOrg();
  const billing = useBilling(org.id);
  const entitlements = useEntitlements(org.id);
  const checkout = useCheckout(org.id);
  const portal = usePortal(org.id);

  if (!can("manageBilling")) return <p className="text-muted-foreground">{t("ownerOnly")}</p>;
  if (billing.isError) return <p role="alert" className="text-error">{message(billing.error)}</p>;
  if (!billing.data || !entitlements.data) return <div className="h-40" aria-busy="true" />;
  const current = billing.data.plans?.find((p) => p.id === billing.data.planId);
  const limits = entitlements.data.limits as Record<string, number | boolean | undefined>;
  const usage = entitlements.data.usage as Record<string, number | undefined>;
  const here = () => window.location.href;
  const value = (key: string, v: unknown) =>
    typeof v === "boolean" ? (v ? t("yes") : t("no")) : typeof v === "number" ? t(`units.${key}`, { n: format.number(v) }) : t("unlimited");

  return (
    <div className="flex max-w-4xl flex-col gap-8" data-testid="billing-settings" data-plan={billing.data.planId}>
      <section className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <h2 className="text-title">{t("plan", { name: current?.name ?? billing.data.planId })}</h2>
        <span className="label-caps text-muted-foreground">{t(`status.${billing.data.status}`)}</span>
        {billing.data.currentPeriodEnd && <span className="text-muted-foreground">{t("renews", { date: format.dateTime(new Date(billing.data.currentPeriodEnd), { dateStyle: "medium" }) })}</span>}
        <Button variant="outline" className="ml-auto" onClick={() => portal.mutate(here())} disabled={portal.isPending} data-testid="billing-portal">
          {t("manage")}
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="label-caps">{t("limits")}</h3>
        <dl className="grid max-w-2xl gap-3">
          {METERED.map((key) => {
            const max = limits[key];
            const used = usage[USAGE_OF[key]] ?? 0;
            const share = typeof max === "number" && max > 0 ? Math.min(1, used / max) : 0;
            return (
              <div key={key} className="grid grid-cols-[12rem_1fr_auto] items-center gap-3" data-testid={`limit-${key}`} data-used={used} data-max={typeof max === "number" ? max : ""}>
                <dt>{t(`limitNames.${key}`)}</dt>
                <dd className="h-2 bg-muted" aria-hidden>
                  <div className={cn("h-2", share >= 1 ? "bg-attention" : "bg-[var(--link)]")} style={{ width: `${share * 100}%` }} />
                </dd>
                <dd className="tabular-nums">{typeof max === "number" ? t("usedOf", { used: format.number(used), max: format.number(max) }) : t("usedUnlimited", { used: format.number(used) })}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="label-caps">{t("change")}</h3>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          {(billing.data.plans ?? []).map((p: Plan) => {
            const isCurrent = p.id === billing.data.planId;
            const e = p.entitlements as Record<string, unknown>;
            return (
              <li key={p.id} className={cn("flex flex-col gap-3 border border-border p-4", isCurrent && "border-[var(--link)]")} data-testid="plan-card" data-plan={p.id}>
                <h4 className="font-semibold">{p.name}</h4>
                <dl className="flex flex-col gap-1">
                  {LISTED.map((key) => (
                    <div key={key} className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{t(`limitNames.${key}`)}</dt>
                      <dd className="tabular-nums">{value(key, e[key])}</dd>
                    </div>
                  ))}
                </dl>
                <Button
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || checkout.isPending}
                  onClick={() => checkout.mutate({ planId: p.id, returnUrl: here() })}
                  className="mt-auto"
                  data-testid="choose-plan"
                >
                  {isCurrent ? t("current") : t("choose")}
                </Button>
              </li>
            );
          })}
        </ul>
        {(checkout.isError || portal.isError) && (
          <p role="alert" className="text-error">
            {message(checkout.error ?? portal.error)}
          </p>
        )}
      </section>
    </div>
  );
}
