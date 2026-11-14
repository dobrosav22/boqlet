"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  useAdminAddNote,
  useAdminNotes,
  useAdminOrg,
  useAdminSetOverrides,
  useAdminSetSubscription,
  useAdminUpdateOrg,
  type AdminOrgDetail,
} from "@/api/hooks/admin";
import { usePlans } from "@/api/hooks/models";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReasonDialog } from "./reason-dialog";
import { parseOverrideValue, parseTags } from "./values";

const day = (d: Date) => d.toISOString().slice(0, 10);

function Section({ title, children, testId }: { title: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <section className="flex flex-col gap-3" data-testid={testId}>
      <h2 className="label-caps">{title}</h2>
      {children}
    </section>
  );
}

/**
 * S36 org detail (F19 §4): metadata, subscription, entitlements with overrides, members, counts,
 * usage, limit events, setup, notes and tags; actions with a reason (plan, trial, override,
 * suspend). Never project content (BR-57): the API sends none.
 */
export function AdminOrgDetailView({ orgId }: { orgId: string }) {
  const t = useTranslations("admin.org");
  const to = useTranslations("admin.orgs");
  const format = useFormatter();
  const message = useErrorMessage();
  const org = useAdminOrg(orgId);
  if (org.isError)
    return (
      <p role="alert" className="text-error">
        {message(org.error)}
      </p>
    );
  if (!org.data) return <div className="h-40" aria-busy="true" />;
  const o = org.data;
  const date = (d: string | null | undefined, time = false) => (d ? format.dateTime(new Date(d), time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }) : to("never"));
  const suspended = o.status === "suspended";

  return (
    <div className="flex max-w-5xl flex-col gap-8" data-testid="admin-org">
      <div className="flex flex-col gap-2">
        <Link href="/admin/orgs" className="text-link underline-offset-4 hover:underline">
          {t("back")}
        </Link>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-title" data-testid="admin-org-name">
            {o.name}
          </h1>
          <span className="label-caps text-muted-foreground" data-testid="admin-org-status">
            {o.planId} · {suspended ? to("statuses.suspended") : o.subscriptionStatus === "trialing" ? to("statuses.trialing") : to("statuses.active")}
          </span>
        </div>
        <p className="text-muted-foreground">
          {t("slugless", { date: date(o.createdAt) })} · {o.ownerEmail}
          {o.country ? ` · ${o.country}` : ""}
        </p>
        {suspended && (
          <p role="status" className="border-l-2 border-[var(--red)] pl-3" data-testid="admin-org-suspended">
            {t("suspendedBanner")}
          </p>
        )}
      </div>

      <Actions org={o} />

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title={t("subscription")}>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
            <dt className="text-muted-foreground">{t("provider")}</dt>
            <dd>{t("providerManual")}</dd>
            <dt className="text-muted-foreground">{t("subscriptionStatus")}</dt>
            <dd data-testid="admin-org-subscription">{o.subscriptionStatus === "trialing" ? to("statuses.trialing") : to("statuses.active")}</dd>
            <dt className="text-muted-foreground">{t("trialEndsAt")}</dt>
            <dd data-testid="admin-org-trial">{o.trialEndsAt ? date(o.trialEndsAt) : t("noTrial")}</dd>
          </dl>
          <h3 className="label-caps text-muted-foreground">{t("planHistory")}</h3>
          {(o.planHistory ?? []).length === 0 ? (
            <p className="text-muted-foreground">{t("noPlanHistory")}</p>
          ) : (
            <ul className="flex flex-col gap-1" data-testid="admin-org-plan-history">
              {(o.planHistory ?? []).map((h, i) => (
                <li key={i}>{t("planChangedBy", { plan: h.planId ?? "", date: date(h.at, true), by: h.by ?? "" })}</li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t("entitlements")} testId="admin-org-entitlements">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("entitlement")}</TableHead>
                <TableHead className="text-right">{t("value")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(o.entitlements ?? {}).map(([k, v]) => {
                const overridden = Object.prototype.hasOwnProperty.call(o.overrides ?? {}, k);
                return (
                  <TableRow key={k} data-testid={`admin-ent-${k}`}>
                    <TableCell>{k}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {String(v)}
                      {overridden && <span className="label-caps ml-2 text-[var(--orange)]">{t("overridden")}</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Section>
      </div>

      <Section title={t("members")} testId="admin-org-members">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("member")}</TableHead>
              <TableHead>{t("email")}</TableHead>
              <TableHead>{t("role")}</TableHead>
              <TableHead>{t("lastActive")}</TableHead>
              <TableHead>{t("activeSession")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(o.members ?? []).map((m) => (
              <TableRow key={m.userId}>
                <TableCell>{m.name}</TableCell>
                <TableCell>{m.email}</TableCell>
                <TableCell>{m.role}</TableCell>
                <TableCell>{date(m.lastActiveAt, true)}</TableCell>
                <TableCell>{m.activeSession ? t("yes") : t("no")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title={t("counts")} testId="admin-org-counts">
          <dl className="grid grid-cols-[1fr_max-content] gap-x-6 gap-y-1">
            {Object.entries(o.counts ?? {}).map(([k, n]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{t.has(`countNames.${k}`) ? t(`countNames.${k}`) : k}</dt>
                <dd className="text-right tabular-nums">{format.number(n)}</dd>
              </div>
            ))}
          </dl>
        </Section>
        <Section title={t("setup")}>
          <p data-testid="admin-org-setup">
            {!o.setup ? t("setupNone") : o.setup.status === "done" ? t("setupDone", { date: date(o.setup.completedAt ?? o.setup.updatedAt) }) : t("setupStep", { step: o.setup.step })}
          </p>
        </Section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title={t("usage")} testId="admin-org-usage">
          {(o.usageByMonth ?? []).length === 0 ? (
            <p className="text-muted-foreground">{t("noUsage")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("month")}</TableHead>
                  <TableHead>{t("kind")}</TableHead>
                  <TableHead className="text-right">{t("minutes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(o.usageByMonth ?? []).map((u) => (
                  <TableRow key={`${u.month}-${u.kind}`}>
                    <TableCell className="tabular-nums">{u.month}</TableCell>
                    <TableCell>{u.kind}</TableCell>
                    <TableCell className="text-right tabular-nums">{format.number(u.minutes ?? 0, { maximumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
        <Section title={t("limitEvents")} testId="admin-org-limit-events">
          {(o.limitEvents ?? []).length === 0 ? (
            <p className="text-muted-foreground">{t("noLimitEvents")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("at")}</TableHead>
                  <TableHead>{t("limit")}</TableHead>
                  <TableHead className="text-right">{t("value")}</TableHead>
                  <TableHead>{t("action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(o.limitEvents ?? []).map((e, i) => (
                  <TableRow key={i}>
                    <TableCell>{date(e.at, true)}</TableCell>
                    <TableCell>{e.limit}</TableCell>
                    <TableCell className="text-right tabular-nums">{to("usedOf", { used: format.number(e.current ?? 0), max: format.number(e.max ?? 0) })}</TableCell>
                    <TableCell>{e.action}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Notes orgId={o.id} />
        <Tags org={o} />
      </div>

      <Section title={t("settings")}>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1" data-testid="admin-org-settings">
          {Object.entries(o.settings ?? {}).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}

function Actions({ org }: { org: AdminOrgDetail }) {
  const t = useTranslations("admin.org");
  const plans = usePlans();
  const subscription = useAdminSetSubscription(org.id);
  const overrides = useAdminSetOverrides(org.id);
  const update = useAdminUpdateOrg(org.id);
  const [planId, setPlanId] = useState(org.planId);
  const [trialDay, setTrialDay] = useState(() => day(new Date(Date.now() + 14 * 86_400_000)));
  const [key, setKey] = useState(() => Object.keys(org.entitlements ?? {})[0] ?? "seats");
  const [value, setValue] = useState("");
  const suspended = org.status === "suspended";
  const parsed = parseOverrideValue(value);
  const saved = () => toast.success(t("saved"));
  const fromTrial = org.trialEndsAt && org.trialEndsAt > new Date().toISOString() ? new Date(org.trialEndsAt) : new Date();
  return (
    <Section title={t("actions")}>
      <div className="flex flex-wrap gap-2" data-testid="admin-org-actions">
        <ReasonDialog
          testId="admin-plan"
          trigger={<Button variant="outline" data-testid="admin-plan">{t("changePlan")}</Button>}
          title={t("changePlan")}
          submit={t("save")}
          canSubmit={planId !== org.planId}
          onSubmit={async (reason) => {
            await subscription.mutateAsync({ planId, reason });
            saved();
          }}
        >
          <Field id="admin-plan-select" label={t("planField")}>
            <NativeSelect id="admin-plan-select" value={planId} onChange={(e) => setPlanId(e.target.value)} data-testid="admin-plan-select">
              {(plans.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </ReasonDialog>

        <ReasonDialog
          testId="admin-trial"
          trigger={<Button variant="outline" data-testid="admin-trial">{t("extendTrial")}</Button>}
          title={t("extendTrial")}
          submit={t("save")}
          canSubmit={!!trialDay}
          onSubmit={async (reason) => {
            await subscription.mutateAsync({ trialEndsAt: new Date(`${trialDay}T23:59:59.000Z`).toISOString(), reason });
            saved();
          }}
        >
          <Field id="admin-trial-date" label={t("trialField")}>
            <Input id="admin-trial-date" type="date" value={trialDay} onChange={(e) => setTrialDay(e.target.value)} data-testid="admin-trial-date" />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-caps text-muted-foreground">{t("trialDays")}</span>
            {[7, 14, 30].map((n) => (
              <Button key={n} type="button" variant="outline" size="sm" onClick={() => setTrialDay(day(new Date(fromTrial.getTime() + n * 86_400_000)))} data-testid={`admin-trial-plus-${n}`}>
                {t("trialPlus", { n })}
              </Button>
            ))}
          </div>
        </ReasonDialog>

        {org.trialEndsAt && (
          <ReasonDialog
            testId="admin-trial-end"
            trigger={<Button variant="outline" data-testid="admin-trial-end">{t("endTrial")}</Button>}
            title={t("endTrial")}
            submit={t("save")}
            onSubmit={async (reason) => {
              await subscription.mutateAsync({ trialEndsAt: null, reason });
              saved();
            }}
          />
        )}

        <ReasonDialog
          testId="admin-override"
          trigger={<Button variant="outline" data-testid="admin-override">{t("override")}</Button>}
          title={t("override")}
          submit={t("save")}
          canSubmit={parsed !== undefined}
          onSubmit={async (reason) => {
            await overrides.mutateAsync({ overrides: { [key]: parsed ?? null }, reason });
            setValue("");
            saved();
          }}
        >
          <Field id="admin-override-key" label={t("overrideKey")}>
            <NativeSelect id="admin-override-key" value={key} onChange={(e) => setKey(e.target.value)} data-testid="admin-override-key">
              {Object.keys(org.entitlements ?? {}).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="admin-override-value" label={t("overrideValue")} hint={t("overrideValueHint")}>
            <Input id="admin-override-value" value={value} onChange={(e) => setValue(e.target.value)} data-testid="admin-override-value" />
          </Field>
        </ReasonDialog>

        <ReasonDialog
          testId="admin-suspend"
          destructive={!suspended}
          trigger={
            <Button variant={suspended ? "outline" : "destructive"} data-testid="admin-suspend">
              {suspended ? t("reactivate") : t("suspend")}
            </Button>
          }
          title={suspended ? t("reactivate") : t("suspend")}
          body={suspended ? t("reactivateBody") : t("suspendBody")}
          submit={suspended ? t("reactivate") : t("suspend")}
          onSubmit={async (reason) => {
            await update.mutateAsync({ status: suspended ? "active" : "suspended", reason });
            saved();
          }}
        />
      </div>
    </Section>
  );
}

function Notes({ orgId }: { orgId: string }) {
  const t = useTranslations("admin.org");
  const format = useFormatter();
  const notes = useAdminNotes(orgId);
  const add = useAdminAddNote(orgId);
  const [text, setText] = useState("");
  return (
    <Section title={t("notes")} testId="admin-org-notes">
      <form
        className="flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          await add.mutateAsync(text.trim());
          setText("");
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          aria-label={t("notes")}
          placeholder={t("notePlaceholder")}
          className="rounded-[var(--radius)] border border-input bg-transparent px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="admin-note-text"
        />
        <Button type="submit" variant="outline" className="self-start" disabled={!text.trim() || add.isPending} data-testid="admin-note-add">
          {t("addNote")}
        </Button>
      </form>
      {notes.data && notes.data.length === 0 && <p className="text-muted-foreground">{t("noNotes")}</p>}
      <ul className="flex flex-col divide-y divide-border">
        {(notes.data ?? []).map((n) => (
          <li key={n.id} className="flex flex-col gap-0.5 py-2" data-testid="admin-note">
            <span className="whitespace-pre-wrap">{n.text}</span>
            <span className="text-muted-foreground">{t("noteBy", { name: n.author.name, date: format.dateTime(new Date(n.createdAt), { dateStyle: "medium", timeStyle: "short" }) })}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Tags({ org }: { org: AdminOrgDetail }) {
  const t = useTranslations("admin.org");
  const update = useAdminUpdateOrg(org.id);
  const [raw, setRaw] = useState((org.tags ?? []).join(", "));
  return (
    <Section title={t("tags")} testId="admin-org-tags">
      {(org.tags ?? []).length === 0 ? (
        <p className="text-muted-foreground">{t("noTags")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2" data-testid="admin-org-tag-list">
          {(org.tags ?? []).map((tag) => (
            <li key={tag} className="label-caps border border-foreground px-2 py-0.5">
              {tag}
            </li>
          ))}
        </ul>
      )}
      <ReasonDialog
        testId="admin-tags"
        trigger={
          <Button variant="outline" className="self-start" data-testid="admin-tags" onClick={() => setRaw((org.tags ?? []).join(", "))}>
            {t("editTags")}
          </Button>
        }
        title={t("editTags")}
        submit={t("save")}
        onSubmit={async (reason) => {
          await update.mutateAsync({ tags: parseTags(raw), reason });
        }}
      >
        <Field id="admin-tags-input" label={t("tagsField")}>
          <Input id="admin-tags-input" value={raw} onChange={(e) => setRaw(e.target.value)} data-testid="admin-tags-input" />
        </Field>
      </ReasonDialog>
    </Section>
  );
}
