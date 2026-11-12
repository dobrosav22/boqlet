"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import { useProjectMembers } from "@/api/hooks/projects";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrg } from "@/features/orgs/org-context";
import { useProjectScope } from "@/features/projects/project-context";

type ProjectRole = Schemas["ProjectRole"];
const ROLES: ProjectRole[] = ["lead", "estimator", "approver", "viewer"];

/** S17: general, members, archive (F02). */
export default function ProjectSettingsPage() {
  const { project } = useProjectScope();
  return (
    <div className="flex max-w-3xl flex-col gap-12">
      <GeneralForm key={project.updatedAt} />
      <Members />
      <ArchiveSection />
    </div>
  );
}

function useRefreshProject() {
  const client = useQueryClient();
  const { project } = useProjectScope();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.project(project.id) }),
      client.invalidateQueries({ queryKey: keys.projects() }),
      client.invalidateQueries({ queryKey: ["projectMembers", project.id] }),
      client.invalidateQueries({ queryKey: ["projectAudit", project.id] }),
    ]);
}

function GeneralForm() {
  const t = useTranslations("projects.settings");
  const message = useErrorMessage();
  const { project, can } = useProjectScope();
  const refresh = useRefreshProject();
  const editable = can("edit");
  const [form, setForm] = useState({
    name: project.name,
    code: project.code ?? "",
    client: project.client ?? "",
    address: project.location?.address ?? "",
    country: project.location?.country ?? "",
    currency: project.currency,
    unitSystem: project.unitSystem,
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const save = useMutation({
    mutationFn: async () =>
      api.PATCH("/projects/{projectId}", {
        params: { path: { projectId: project.id } },
        body: {
          name: form.name.trim(),
          code: form.code.trim(),
          client: form.client.trim(),
          location: { address: form.address.trim(), country: form.country.trim().toUpperCase() },
          currency: form.currency.trim().toUpperCase(),
          unitSystem: form.unitSystem,
        },
      }),
    onSuccess: async () => {
      toast(t("saved"));
      await refresh();
    },
    onError: () => {},
  });
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="label-caps">{t("general")}</h2>
      <fieldset disabled={!editable || save.isPending} className="flex flex-col gap-4">
        <Field id="p-name" label={t("name")}>
          <Input id="p-name" value={form.name} onChange={set("name")} required data-testid="project-settings-name" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="p-code" label={t("code")}>
            <Input id="p-code" value={form.code} onChange={set("code")} />
          </Field>
          <Field id="p-client" label={t("client")}>
            <Input id="p-client" value={form.client} onChange={set("client")} />
          </Field>
        </div>
        <div className="grid grid-cols-[2fr_1fr] gap-4">
          <Field id="p-address" label={t("address")}>
            <Input id="p-address" value={form.address} onChange={set("address")} />
          </Field>
          <Field id="p-country" label={t("country")}>
            <Input id="p-country" value={form.country} maxLength={2} onChange={set("country")} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field id="p-currency" label={t("currency")}>
            <Input id="p-currency" value={form.currency} maxLength={3} onChange={set("currency")} />
          </Field>
          <Field id="p-units" label={t("units")} hint={t("unitsHint")}>
            <NativeSelect id="p-units" value={form.unitSystem} onChange={set("unitSystem")}>
              <option value="metric">{t("metric")}</option>
              <option value="imperial">{t("imperial")}</option>
            </NativeSelect>
          </Field>
        </div>
        {save.error && (
          <p role="alert" className="text-error">
            {message(save.error)}
          </p>
        )}
        {editable && (
          <div>
            <Button type="submit" disabled={!form.name.trim()} data-testid="project-settings-save">
              {t("save")}
            </Button>
          </div>
        )}
      </fieldset>
    </form>
  );
}

function Members() {
  const t = useTranslations("projects.settings");
  const roles = useTranslations("projects.list.roles");
  const message = useErrorMessage();
  const { org } = useOrg();
  const { project, can } = useProjectScope();
  const members = useProjectMembers(project.id);
  const orgMembers = useQuery({
    queryKey: keys.members(org.id),
    queryFn: async () => (await api.GET("/orgs/{orgId}/members", { params: { path: { orgId: org.id } } })).data!,
  });
  const refresh = useRefreshProject();
  const manage = can("manageMembers");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("estimator");
  const [hint, setHint] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: async (userId: string) => api.POST("/projects/{projectId}/members", { params: { path: { projectId: project.id } }, body: { userId, role } }),
    onSuccess: async () => {
      setEmail("");
      await refresh();
    },
    onError: (e) => setHint(message(e)),
  });
  const change = useMutation({
    mutationFn: async ({ userId, role: r }: { userId: string; role: ProjectRole }) =>
      api.PATCH("/projects/{projectId}/members/{userId}", { params: { path: { projectId: project.id, userId } }, body: { role: r } }),
    onSuccess: refresh,
    onError: (e) => {
      toast.error(message(e));
      void refresh();
    },
  });
  const remove = useMutation({
    mutationFn: async (userId: string) => api.DELETE("/projects/{projectId}/members/{userId}", { params: { path: { projectId: project.id, userId } } }),
    onSuccess: refresh,
    onError: (e) => toast.error(message(e)),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setHint(null);
    const found = orgMembers.data?.find((m) => m.user.email.toLowerCase() === email.trim().toLowerCase());
    // Project members are org members only (P28): anyone else gets a share link (F18).
    if (!found) return setHint(t("notInOrg"));
    add.mutate(found.user.id);
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="label-caps">{t("members")}</h2>
      <p className="text-muted-foreground">{t("membersNote")}</p>
      {manage && (
        <form className="flex items-end gap-3" onSubmit={submit} data-testid="add-project-member">
          <Field id="pm-email" label={t("memberEmail")} className="flex-1" error={hint ?? undefined}>
            <Input id="pm-email" type="email" list="pm-org-members" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="project-member-email" />
            <datalist id="pm-org-members">
              {orgMembers.data?.map((m) => (
                <option key={m.user.id} value={m.user.email}>
                  {m.user.name}
                </option>
              ))}
            </datalist>
          </Field>
          <Field id="pm-role" label={t("role")}>
            <NativeSelect id="pm-role" value={role} onChange={(e) => setRole(e.target.value as ProjectRole)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roles(r)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Button type="submit" disabled={add.isPending} data-testid="project-member-add">
            {t("add")}
          </Button>
        </form>
      )}
      <Table data-testid="project-members">
        <TableHeader>
          <TableRow>
            <TableHead className="label-caps">{t("name")}</TableHead>
            <TableHead className="label-caps">{t("email")}</TableHead>
            <TableHead className="label-caps">{t("role")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.data?.map((m) => (
            <TableRow key={m.user.id} data-testid={`project-member-${m.user.email}`}>
              <TableCell>{m.user.name}</TableCell>
              <TableCell className="text-muted-foreground">{m.user.email}</TableCell>
              <TableCell>
                {manage ? (
                  <NativeSelect aria-label={t("roleOf", { name: m.user.name })} value={m.role} onChange={(e) => change.mutate({ userId: m.user.id, role: e.target.value as ProjectRole })}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roles(r)}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  roles(m.role)
                )}
              </TableCell>
              <TableCell className="text-right">
                {manage && (
                  <Button variant="ghost" onClick={() => remove.mutate(m.user.id)}>
                    {t("remove")}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

function ArchiveSection() {
  const t = useTranslations("projects.settings");
  const message = useErrorMessage();
  const { project, can } = useProjectScope();
  const refresh = useRefreshProject();
  const toggle = useMutation({
    mutationFn: async () =>
      project.status === "archived"
        ? api.POST("/projects/{projectId}/unarchive", { params: { path: { projectId: project.id } } })
        : api.POST("/projects/{projectId}/archive", { params: { path: { projectId: project.id } } }),
    onSuccess: refresh,
    onError: () => {},
  });
  if (!can("archive")) return null;
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <h2 className="label-caps">{project.status === "archived" ? t("restoreTitle") : t("archiveTitle")}</h2>
      <p className="prose-text text-muted-foreground">{project.status === "archived" ? t("restoreBody") : t("archiveBody")}</p>
      {toggle.error && (
        <p role="alert" className="text-error">
          {message(toggle.error)}
        </p>
      )}
      <div>
        <Button variant="outline" onClick={() => toggle.mutate()} disabled={toggle.isPending} data-testid="archive-toggle">
          {project.status === "archived" ? t("restore") : t("archive")}
        </Button>
      </div>
    </section>
  );
}
