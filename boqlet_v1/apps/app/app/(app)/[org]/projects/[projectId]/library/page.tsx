"use client";

import { useTranslations } from "next-intl";
import { LibraryList } from "@/features/library/library-list";
import { useProjectScope } from "@/features/projects/project-context";

/** S16: the project's own presets (F10 §1): project dictionaries and patches, edited by leads and estimators. */
export default function ProjectLibraryPage() {
  const t = useTranslations("library.home");
  const { project, can } = useProjectScope();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">{t("projectIntro")}</p>
      <LibraryList projectId={project.id} canCreate={can("editPresets") && project.status !== "archived"} />
    </div>
  );
}
