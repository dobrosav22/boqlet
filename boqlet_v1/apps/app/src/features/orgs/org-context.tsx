"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { Schemas } from "@ifc-boq/api";
import { useTranslations } from "next-intl";
import { useMe } from "@/api/hooks/me";
import { NotFoundView } from "@/components/errors/not-found-view";
import { orgCan, type OrgAction, type OrgRole } from "@/lib/permissions";

export interface OrgScope {
  org: Schemas["Org"];
  role: OrgRole;
  can: (action: OrgAction) => boolean;
}

const OrgContext = createContext<OrgScope | null>(null);
const LAST_ORG_KEY = "boqlet-last-org";

export function rememberOrg(slug: string) {
  try {
    window.localStorage.setItem(LAST_ORG_KEY, slug);
  } catch {
    /* storage blocked */
  }
}
export function lastOrg(): string | null {
  try {
    return window.localStorage.getItem(LAST_ORG_KEY);
  } catch {
    return null;
  }
}

/**
 * Resolves `/{org}` from `GET /me` (slugs are a frontend routing concern, conventions.md). Every
 * request below uses this org's id, so switching orgs switches every request (F01-AC6).
 */
export function OrgProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const me = useMe();
  const membership = me.data?.memberships.find((m) => m.org.slug === slug);

  useEffect(() => {
    if (membership) rememberOrg(slug);
  }, [membership, slug]);

  if (me.isPending) return <div className="min-h-dvh" aria-busy="true" />;
  if (!membership) {
    return (
      <main className="mx-auto max-w-3xl px-8">
        <NotFoundView />
      </main>
    );
  }
  const scope: OrgScope = { org: membership.org, role: membership.role, can: (action) => orgCan(membership.role, action) };
  return (
    <OrgContext.Provider value={scope}>
      {membership.org.status === "suspended" && <SuspendedBanner />}
      {children}
    </OrgContext.Provider>
  );
}

/** F19: a suspended org is read-only; every change answers 409 org_suspended. */
function SuspendedBanner() {
  const t = useTranslations("orgs");
  return (
    <p role="status" className="border-b border-border bg-[var(--red)] px-4 py-2 text-center text-[var(--paper)]" data-testid="org-suspended">
      {t("suspended")}
    </p>
  );
}

export function useOrg(): OrgScope {
  const scope = useContext(OrgContext);
  if (!scope) throw new Error("useOrg outside an org route");
  return scope;
}
