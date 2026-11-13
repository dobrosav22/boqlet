"use client";

import { DecisionsTable } from "@/features/decisions/decisions-table";

/** S13: the project's decisions (F05 §7). Everyone on the project reads them; leads and estimators change them. */
export default function ProjectDecisionsPage() {
  return <DecisionsTable />;
}
