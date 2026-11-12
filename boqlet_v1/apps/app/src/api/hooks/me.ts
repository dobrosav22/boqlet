"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import { useSession } from "@/auth";

/** `GET /me`: the user, their orgs and roles. Org-level permissions come from here (`orgCan`). */
export function useMe() {
  const session = useSession();
  return useQuery({
    queryKey: keys.me(),
    enabled: session.status === "authenticated",
    queryFn: async () => (await api.GET("/me")).data!,
  });
}
