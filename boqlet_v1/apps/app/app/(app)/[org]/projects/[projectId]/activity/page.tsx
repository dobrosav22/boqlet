"use client";

import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/api/client";
import { saveFile } from "@/api/hooks/exports";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { ActivityList } from "@/features/projects/activity-list";
import { useProjectScope } from "@/features/projects/project-context";

/** S18: the project's activity (leads and approvers), and its audit as CSV (F12). */
export default function ProjectActivityPage() {
  const t = useTranslations("projects.activity");
  const message = useErrorMessage();
  const { project, can } = useProjectScope();
  const csv = useMutation({
    mutationFn: async () => {
      const { data } = await api.GET("/projects/{projectId}/audit.csv", { params: { path: { projectId: project.id } }, parseAs: "blob" });
      saveFile(data as unknown as Blob, `${(project.code ?? project.name).replace(/[^\w.-]+/g, "-")}_audit.csv`);
    },
    onError: () => {},
  });
  if (!can("seeAudit")) return <p className="text-muted-foreground">{t("notAllowed")}</p>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => csv.mutate()} disabled={csv.isPending} data-testid="audit-csv">
          <Download aria-hidden />
          {t("csv")}
        </Button>
      </div>
      {csv.error ? (
        <p role="alert" className="text-error">
          {message(csv.error)}
        </p>
      ) : null}
      <ActivityList projectId={project.id} />
    </div>
  );
}
