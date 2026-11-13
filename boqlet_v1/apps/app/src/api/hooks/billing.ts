"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

export type Plan = Schemas["Plan"];
export type Entitlements = Schemas["EntitlementsResponse"];

/** Effective limits and their usage (F14). A plan change arrives as `entity.changed` on the org. */
export function useEntitlements(orgId: string | undefined) {
  return useQuery({
    queryKey: keys.entitlements(orgId ?? "none"),
    enabled: !!orgId,
    queryFn: async () => (await api.GET("/orgs/{orgId}/entitlements", { params: { path: { orgId: orgId! } } })).data!,
  });
}

/** This month's processing usage (S24). */
export function useUsage(orgId: string, month?: string) {
  return useQuery({
    queryKey: keys.usage(orgId, month ?? "current"),
    queryFn: async () => (await api.GET("/orgs/{orgId}/usage", { params: { path: { orgId }, query: month ? { month } : {} } })).data!,
  });
}

/** The subscription and the plans to choose from (S23). */
export function useBilling(orgId: string) {
  return useQuery({
    queryKey: keys.billing(orgId),
    queryFn: async () => (await api.GET("/orgs/{orgId}/billing", { params: { path: { orgId } } })).data!,
  });
}

/** F14: the frontend only asks for the provider's page and goes there. */
export function useCheckout(orgId: string) {
  return useMutation({
    mutationFn: async ({ planId, returnUrl }: { planId: string; returnUrl: string }) =>
      (await api.POST("/orgs/{orgId}/billing/checkout", { params: { path: { orgId } }, body: { planId, returnUrl } })).data!,
    onSuccess: ({ url }) => window.location.assign(url),
  });
}

export function usePortal(orgId: string) {
  return useMutation({
    mutationFn: async (returnUrl: string) => (await api.POST("/orgs/{orgId}/billing/portal", { params: { path: { orgId } }, body: { returnUrl } })).data!,
    onSuccess: ({ url }) => window.location.assign(url),
  });
}
