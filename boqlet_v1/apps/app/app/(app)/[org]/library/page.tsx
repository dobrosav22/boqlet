"use client";

import { useTranslations } from "next-intl";
import { useOrg } from "@/features/orgs/org-context";
import { LibraryList } from "@/features/library/library-list";

/** S19: the org's Library (F10 §1). Members view and pick; library editors create and edit. */
export default function LibraryPage() {
  const t = useTranslations("library.home");
  const { can } = useOrg();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-title">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <LibraryList canCreate={can("editLibrary")} />
    </div>
  );
}
