"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

/** "Try with a sample project" (FL-1 step 5): the Duplex sample, outside the project limit. */
export function useCreateSample(org: { id: string; slug: string }) {
  const t = useTranslations("projects");
  const router = useRouter();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await api.POST("/orgs/{orgId}/projects", { params: { path: { orgId: org.id } }, body: { name: t("sampleName"), sample: "duplex" } })).data!,
    onSuccess: async (project) => {
      await client.invalidateQueries({ queryKey: keys.projects(org.id) });
      router.push(`/${org.slug}/projects/${project.id}`);
    },
  });
}
