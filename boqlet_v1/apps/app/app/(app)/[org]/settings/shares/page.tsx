"use client";

import { useTranslations } from "next-intl";
import { useOrgShareLinks } from "@/api/hooks/shares";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { useOrg } from "@/features/orgs/org-context";
import { LinkRow } from "@/features/shares/share-dialog";

/** F18 §3: every share link of the org's BoQs (owners and admins), each revocable. */
export default function ShareLinksSettingsPage() {
  const t = useTranslations("shares");
  const message = useErrorMessage();
  const { org, can } = useOrg();
  const links = useOrgShareLinks(org.id);
  if (!can("manageShareLinks")) return null;
  return (
    <section className="flex flex-col gap-3" data-testid="org-share-links">
      <p className="text-muted-foreground">{t("orgIntro")}</p>
      {links.isError && (
        <p role="alert" className="text-error">
          {message(links.error)}
        </p>
      )}
      {links.data && links.data.length === 0 && <p className="text-muted-foreground">{t("noOrgLinks")}</p>}
      {(links.data ?? []).map((l) => (
        <LinkRow key={l.id} link={l} showBoq />
      ))}
    </section>
  );
}
