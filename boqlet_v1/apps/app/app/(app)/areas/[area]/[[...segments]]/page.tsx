"use client";

import { use } from "react";
import { AreaHost } from "@/extensions/area-host";

/** Module areas (`area.routes`), reached through the rewrites next.config makes for the modules in the build. */
export default function AreaPage({ params }: { params: Promise<{ area: string; segments?: string[] }> }) {
  const { area, segments } = use(params);
  return <AreaHost area={area} segments={segments ?? []} />;
}
