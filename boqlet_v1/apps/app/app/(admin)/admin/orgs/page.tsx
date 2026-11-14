"use client";

import { Suspense } from "react";
import { AdminOrgsTable } from "@/features/admin/orgs-table";

export default function AdminOrgsPage() {
  return (
    <Suspense>
      <AdminOrgsTable />
    </Suspense>
  );
}
