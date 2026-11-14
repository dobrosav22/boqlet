"use client";

import { use } from "react";
import { NotFoundView } from "@/components/errors/not-found-view";
import { extensions } from "@/extensions";
import { useOrg } from "@/features/orgs/org-context";

/** A module's section of org settings (`settings.orgSections`, P36); the core's sections have their own routes. */
export default function ModuleSettingsPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = use(params);
  const { can } = useOrg();
  const found = extensions("settings.orgSections").find((s) => s.path === section);
  if (!found || (found.action && !can(found.action))) return <NotFoundView />;
  return <found.Section />;
}
