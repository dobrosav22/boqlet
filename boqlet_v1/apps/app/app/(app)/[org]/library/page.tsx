"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/features/orgs/org-context";
import { LibraryList } from "@/features/library/library-list";

/** S19: the org's Library (F10 §1). Members view and pick; library editors create and edit. */
export default function LibraryPage() {
  const t = useTranslations("library.home");
  const ts = useTranslations("setup");
  const { org, can } = useOrg();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <div className="flex flex-1 flex-col gap-1">
          <h1 className="text-title">{t("title")}</h1>
          <p className="text-muted-foreground">{t("intro")}</p>
        </div>
        {can("finishSetup") && (
          <Button variant="outline" render={<Link href={`/${org.slug}/setup`} />} nativeButton={false} data-testid="guided-setup">
            {ts("guided")}
          </Button>
        )}
      </div>
      <LibraryList canCreate={can("editLibrary")} />
    </div>
  );
}
