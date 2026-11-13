"use client";

import { useTranslations } from "next-intl";
import { AuditView } from "@/features/audit/audit-view";
import { useOrg } from "@/features/orgs/org-context";

/** S25: the organisation's audit log (owner, admin), with filters and CSV (F09 "Audit log"). */
export default function AuditSettingsPage() {
  const t = useTranslations("audit");
  const { org, can } = useOrg();
  if (!can("seeAudit")) return <p className="text-muted-foreground">{t("notAllowed")}</p>;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">{t("orgIntro")}</p>
      <AuditView scope={{ kind: "org", orgId: org.id }} fileName={`${org.slug}_audit.csv`} projectHref={(id) => `/${org.slug}/projects/${id}`} />
    </div>
  );
}
