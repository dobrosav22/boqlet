"use client";

import { use } from "react";
import { AdminOrgDetailView } from "@/features/admin/org-detail";

export default function AdminOrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = use(params);
  return <AdminOrgDetailView key={orgId} orgId={orgId} />;
}
