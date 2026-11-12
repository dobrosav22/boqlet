"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRelativeTime } from "@/i18n/use-relative-time";
import { useProjects } from "@/api/hooks/projects";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrg } from "@/features/orgs/org-context";

/** All projects I can see, active or archived, with a search (F02). */
export default function ProjectsPage() {
  const t = useTranslations("projects.list");
  const relativeTime = useRelativeTime();
  const message = useErrorMessage();
  const { org, can } = useOrg();
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [q, setQ] = useState("");
  const projects = useProjects(org.id, { status, ...(q ? { q } : {}) });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <h1 className="text-title flex-1">{t("title")}</h1>
        {can("createProjects") && (
          <Button render={<Link href={`/${org.slug}/projects/new`} />} nativeButton={false}>
            {t("new")}
          </Button>
        )}
      </div>
      <div className="flex gap-3">
        <Input aria-label={t("search")} placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <NativeSelect aria-label={t("status")} value={status} onChange={(e) => setStatus(e.target.value as "active" | "archived")} data-testid="project-status-filter">
          <option value="active">{t("active")}</option>
          <option value="archived">{t("archived")}</option>
        </NativeSelect>
      </div>
      {projects.isError && (
        <p role="alert" className="text-error">
          {message(projects.error)}
        </p>
      )}
      {projects.data?.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
      {!!projects.data?.length && (
        <Table data-testid="projects-table">
          <TableHeader>
            <TableRow>
              <TableHead className="label-caps">{t("name")}</TableHead>
              <TableHead className="label-caps">{t("code")}</TableHead>
              <TableHead className="label-caps">{t("client")}</TableHead>
              <TableHead className="label-caps">{t("myRole")}</TableHead>
              <TableHead className="label-caps">{t("lastActivity")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.data.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link href={`/${org.slug}/projects/${p.id}`} className="hover:underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.code}</TableCell>
                <TableCell className="text-muted-foreground">{p.client}</TableCell>
                <TableCell>{p.myRole ? t(`roles.${p.myRole}`) : null}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {p.lastActivityAt ? relativeTime(p.lastActivityAt) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
