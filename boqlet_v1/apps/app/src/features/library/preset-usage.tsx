"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePresetUsage, type Preset } from "@/api/hooks/library";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrg } from "@/features/orgs/org-context";

/** Where used (F10 §9): the BoQ revisions that use a version of the preset, in projects I can see. */
export function PresetUsage({ preset }: { preset: Preset }) {
  const t = useTranslations("library.usage");
  const tr = useTranslations("library");
  const message = useErrorMessage();
  const { org } = useOrg();
  const usage = usePresetUsage(preset.id);
  if (usage.isError) {
    return (
      <p role="alert" className="text-error">
        {message(usage.error)}
      </p>
    );
  }
  if (!usage.data) return <div aria-busy="true" />;
  if (usage.data.length === 0) return <p className="text-muted-foreground">{t("none")}</p>;
  return (
    <Table data-testid="preset-usage">
      <TableHeader>
        <TableRow>
          <TableHead className="label-caps">{t("project")}</TableHead>
          <TableHead className="label-caps">{t("boq")}</TableHead>
          <TableHead className="label-caps">{t("revision")}</TableHead>
          <TableHead className="label-caps">{t("status")}</TableHead>
          <TableHead className="label-caps">{t("version")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {usage.data.map((u) => (
          <TableRow key={u.revisionId} data-testid="usage-row" data-boq={u.boqId}>
            <TableCell>
              <Link href={`/${org.slug}/projects/${u.projectId}`} className="hover:underline">
                {u.projectName}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/${org.slug}/projects/${u.projectId}/boqs/${u.boqId}?tab=setup`} className="hover:underline">
                {u.boqName}
              </Link>
            </TableCell>
            <TableCell className="tabular-nums">{u.revisionLabel}</TableCell>
            <TableCell>{t.has(`statuses.${u.revisionStatus}`) ? t(`statuses.${u.revisionStatus}`) : u.revisionStatus}</TableCell>
            <TableCell className="tabular-nums">{tr("preset.versionN", { n: u.presetVersionNumber })}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
