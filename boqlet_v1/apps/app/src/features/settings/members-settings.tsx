"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { useRelativeTime } from "@/i18n/use-relative-time";
import { toast } from "sonner";
import { api } from "@/api/client";
import { isApiError } from "@/api/errors";
import { keys } from "@/api/keys";
import { useMe } from "@/api/hooks/me";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrg } from "@/features/orgs/org-context";
import type { OrgRole } from "@/lib/permissions";

const ROLES: OrgRole[] = ["owner", "admin", "library_editor", "member"];

/** S22: members (role, remove) and invitations (invite, resend, revoke) (F01 §5–§8). */
export function MembersSettings() {
  const t = useTranslations("settings.members");
  const roles = useTranslations("common.roles");
  const format = useFormatter();
  const relativeTime = useRelativeTime();
  const message = useErrorMessage();
  const { org, role: myRole, can } = useOrg();
  const me = useMe();
  const client = useQueryClient();
  const manage = can("manageMembers");
  const assignable = ROLES.filter((r) => r !== "owner" || myRole === "owner");

  const members = useQuery({
    queryKey: keys.members(org.id),
    queryFn: async () => (await api.GET("/orgs/{orgId}/members", { params: { path: { orgId: org.id } } })).data!,
  });
  const invitations = useQuery({
    queryKey: ["invitations", org.id],
    enabled: manage,
    queryFn: async () => (await api.GET("/orgs/{orgId}/invitations", { params: { path: { orgId: org.id } } })).data!,
  });
  const refresh = () =>
    Promise.all([client.invalidateQueries({ queryKey: keys.members(org.id) }), client.invalidateQueries({ queryKey: ["invitations", org.id] })]);

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");
  const invite = useMutation({
    mutationFn: async () => (await api.POST("/orgs/{orgId}/invitations", { params: { path: { orgId: org.id } }, body: { email: email.trim(), role: inviteRole } })).data!,
    onSuccess: async (inv) => {
      toast(t("invited", { email: inv.email }));
      setEmail("");
      await refresh();
    },
    // 402 opens the limit dialog (global handler); other errors show under the form.
    onError: () => {},
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: OrgRole }) =>
      api.PATCH("/orgs/{orgId}/members/{userId}", { params: { path: { orgId: org.id, userId } }, body: { role } }),
    onSuccess: refresh,
    onError: (e) => {
      toast.error(message(e));
      void refresh();
    },
  });
  const removeMember = useMutation({
    mutationFn: async (userId: string) => api.DELETE("/orgs/{orgId}/members/{userId}", { params: { path: { orgId: org.id, userId } } }),
    onSuccess: refresh,
    onError: (e) => toast.error(message(e)),
  });
  const resend = useMutation({
    mutationFn: async (invitationId: string) =>
      api.POST("/orgs/{orgId}/invitations/{invitationId}/resend", { params: { path: { orgId: org.id, invitationId } } }),
    onSuccess: async () => {
      toast(t("resent"));
      await refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: async (invitationId: string) =>
      api.DELETE("/orgs/{orgId}/invitations/{invitationId}", { params: { path: { orgId: org.id, invitationId } } }),
    onSuccess: refresh,
  });

  const inviteError = invite.error && !(isApiError(invite.error) && invite.error.status === 402) ? message(invite.error) : null;

  return (
    <div className="flex flex-col gap-10">
      {manage && (
        <form
          className="flex max-w-2xl items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) invite.mutate();
          }}
          data-testid="invite-form"
        >
          <Field id="invite-email" label={t("email")} className="flex-1" error={inviteError ?? undefined}>
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="invite-email" />
          </Field>
          <Field id="invite-role" label={t("role")}>
            <NativeSelect id="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as OrgRole)} data-testid="invite-role">
              {assignable.map((r) => (
                <option key={r} value={r}>
                  {roles(r)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Button type="submit" disabled={invite.isPending} data-testid="invite-submit">
            {t("invite")}
          </Button>
        </form>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="label-caps">{t("members")}</h2>
        {members.isError && (
          <p role="alert" className="text-error">
            {message(members.error)}
          </p>
        )}
        <Table data-testid="members-table">
          <TableHeader>
            <TableRow>
              <TableHead className="label-caps">{t("name")}</TableHead>
              <TableHead className="label-caps">{t("email")}</TableHead>
              <TableHead className="label-caps">{t("role")}</TableHead>
              <TableHead className="label-caps">{t("joined")}</TableHead>
              <TableHead className="label-caps">{t("lastActive")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(members.data ?? []).map((m) => {
              const self = m.user.id === me.data?.user.id;
              const canEdit = manage && !self && (m.role !== "owner" || myRole === "owner");
              return (
                <TableRow key={m.user.id} data-testid={`member-${m.user.email}`}>
                  <TableCell>{m.user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.user.email}</TableCell>
                  <TableCell>
                    {canEdit ? (
                      <NativeSelect
                        aria-label={t("roleOf", { name: m.user.name })}
                        value={m.role}
                        onChange={(e) => changeRole.mutate({ userId: m.user.id, role: e.target.value as OrgRole })}
                      >
                        {assignable.concat(assignable.includes(m.role) ? [] : [m.role]).map((r) => (
                          <option key={r} value={r}>
                            {roles(r)}
                          </option>
                        ))}
                      </NativeSelect>
                    ) : (
                      roles(m.role)
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{format.dateTime(new Date(m.createdAt), { dateStyle: "medium" })}</TableCell>
                  <TableCell className="tabular-nums">{m.lastActiveAt ? relativeTime(m.lastActiveAt) : t("never")}</TableCell>
                  <TableCell className="text-right">
                    {canEdit && (
                      <Button variant="ghost" onClick={() => removeMember.mutate(m.user.id)} aria-label={t("removeOf", { name: m.user.name })}>
                        {t("remove")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      {manage && (
        <section className="flex flex-col gap-3">
          <h2 className="label-caps">{t("invitations")}</h2>
          {invitations.data?.length === 0 && <p className="text-muted-foreground">{t("noInvitations")}</p>}
          {!!invitations.data?.length && (
            <Table data-testid="invitations-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="label-caps">{t("email")}</TableHead>
                  <TableHead className="label-caps">{t("role")}</TableHead>
                  <TableHead className="label-caps">{t("status")}</TableHead>
                  <TableHead className="label-caps">{t("expires")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.data.map((inv) => (
                  <TableRow key={inv.id} data-testid={`invitation-${inv.email}`}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell>{roles(inv.role)}</TableCell>
                    <TableCell>{t(`invitationStatus.${inv.status}`)}</TableCell>
                    <TableCell className="tabular-nums">{format.dateTime(new Date(inv.expiresAt), { dateStyle: "medium" })}</TableCell>
                    <TableCell className="flex justify-end gap-2">
                      {(inv.status === "pending" || inv.status === "expired") && (
                        <>
                          {inv.status === "pending" && (
                            <Button variant="ghost" onClick={() => resend.mutate(inv.id)}>
                              {t("resend")}
                            </Button>
                          )}
                          <Button variant="ghost" onClick={() => revoke.mutate(inv.id)}>
                            {t("revoke")}
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      )}
    </div>
  );
}
