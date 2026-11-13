"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

export type OrgSetup = Schemas["OrgSetup"];
export type OrgSetupUpdate = Schemas["OrgSetupUpdate"];

/** F16: the org's setup progress; null when the org never started it (`204`). */
export function useOrgSetup(orgId: string) {
  return useQuery({
    queryKey: ["orgSetup", orgId],
    queryFn: async () => {
      const res = await api.GET("/orgs/{orgId}/setup", { params: { path: { orgId } } });
      return res.response.status === 204 ? null : (res.data ?? null);
    },
  });
}

export function useSaveOrgSetup(orgId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: OrgSetupUpdate) => (await api.PUT("/orgs/{orgId}/setup", { params: { path: { orgId } }, body })).data!,
    onSuccess: async (setup) => {
      client.setQueryData(["orgSetup", orgId], setup);
      // The org (GET /me memberships) carries `setup` too: the dashboard gate reads it.
      await client.invalidateQueries({ queryKey: keys.me() });
    },
  });
}
