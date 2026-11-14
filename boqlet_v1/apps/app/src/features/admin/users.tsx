"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAdminEndSession, useAdminUsers } from "@/api/hooks/admin";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** S36 users (F19 §5): orgs and roles, last sign-in, the active session; end it for a support case. */
export function AdminUsersView() {
  const t = useTranslations("admin.users");
  const tr = useTranslations("common.roles");
  const format = useFormatter();
  const message = useErrorMessage();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setSearch(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);
  const users = useAdminUsers(search);
  const end = useAdminEndSession();
  const rows = users.data?.pages.flatMap((p) => p.items) ?? [];
  const date = (d: string | null | undefined) => (d ? format.dateTime(new Date(d), { dateStyle: "medium", timeStyle: "short" }) : "—");
  return (
    <div className="flex flex-col gap-4" data-testid="admin-users">
      <h1 className="text-title">{t("title")}</h1>
      <label className="flex max-w-sm flex-col gap-1">
        <span className="label-caps text-muted-foreground">{t("search")}</span>
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} data-testid="users-search" />
      </label>
      {users.isError && (
        <p role="alert" className="text-error">
          {message(users.error)}
        </p>
      )}
      {users.isPending && <div className="h-40" aria-busy="true" />}
      {users.data && rows.length === 0 && <p className="text-muted-foreground">{t("none")}</p>}
      {rows.length > 0 && (
        <Table data-testid="users-table">
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("email")}</TableHead>
              <TableHead>{t("orgs")}</TableHead>
              <TableHead>{t("lastSignIn")}</TableHead>
              <TableHead>{t("created")}</TableHead>
              <TableHead>{t("session")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id} data-testid={`users-row-${u.email}`}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{(u.orgs ?? []).map((o) => t("orgRole", { org: o.orgName ?? "", role: o.role && tr.has(o.role) ? tr(o.role) : (o.role ?? "") })).join(", ")}</TableCell>
                <TableCell>{date(u.lastSignInAt)}</TableCell>
                <TableCell>{date(u.createdAt)}</TableCell>
                <TableCell>
                  {u.activeSession ? (
                    <div className="flex items-center gap-3">
                      <span>{u.activeSession.deviceLabel}</span>
                      <ConfirmDialog
                        trigger={
                          <Button variant="outline" size="sm" data-testid={`users-end-${u.email}`}>
                            {t("endSession")}
                          </Button>
                        }
                        title={t("endSessionTitle", { name: u.name })}
                        body={t("endSessionBody", { device: u.activeSession.deviceLabel })}
                        confirm={t("endSession")}
                        destructive
                        testId="users-end-confirm"
                        onConfirm={async () => {
                          await end.mutateAsync(u.id);
                          toast.success(t("ended"));
                        }}
                      />
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{t("noSession")}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {users.hasNextPage && (
        <Button variant="outline" className="self-start" onClick={() => users.fetchNextPage()} disabled={users.isFetchingNextPage}>
          {t("more")}
        </Button>
      )}
    </div>
  );
}
