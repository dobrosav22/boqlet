"use client";

import { NotFoundView } from "@/components/errors/not-found-view";
import { areaAt } from "@/extensions";

/**
 * A module's area (`area.routes`, P36): `/{path}/…` is rewritten to `/areas/{path}/…` (next.config,
 * from the modules in the build), outside any org's chrome. An unknown area is the not-found page.
 */
export function AreaHost({ area, segments }: { area: string; segments: string[] }) {
  const found = areaAt(area);
  if (!found)
    return (
      <main className="mx-auto max-w-3xl px-8">
        <NotFoundView />
      </main>
    );
  return <found.Area segments={segments} />;
}
