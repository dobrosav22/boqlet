"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { Boq } from "@/api/hooks/boqs";
import { useCreateShareLink, useRevokeShareLink, useShareLinks, useUpdateShareLink, type ShareInclude, type ShareLink } from "@/api/hooks/shares";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRelativeTime } from "@/i18n/use-relative-time";

const EXPIRY = ["never", "7", "30", "90"] as const;
type Expiry = (typeof EXPIRY)[number];
const expiresAt = (e: Expiry) => (e === "never" ? null : new Date(Date.now() + Number(e) * 86_400_000).toISOString());

function Includes({ value, onChange, systems }: { value: ShareInclude; onChange: (v: ShareInclude) => void; systems: { id: string; name: string }[] }) {
  const t = useTranslations("shares");
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="label-caps mb-1.5 text-muted-foreground">{t("includes")}</legend>
      <label className="flex items-center gap-2 text-muted-foreground">
        <input type="checkbox" checked disabled />
        {t("include.sheet")}
      </label>
      {(["lineDetail", "viewer", "log", "excel"] as const).map((k) => (
        <label key={k} className="flex items-center gap-2">
          <input type="checkbox" checked={value[k] === true} onChange={(e) => onChange({ ...value, [k]: e.target.checked })} data-testid={`share-include-${k}`} />
          {t(`include.${k}`)}
        </label>
      ))}
      {systems.length > 1 && (
        <label className="mt-1 flex flex-col gap-1">
          <span className="label-caps text-muted-foreground">{t("groupBy")}</span>
          <NativeSelect value={value.groupBy ?? systems[0]!.id} onChange={(e) => onChange({ ...value, groupBy: e.target.value })}>
            {systems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}
    </fieldset>
  );
}

/**
 * F18 §1, §3: share this BoQ as a public, read-only link: what (this version as it is now, or always the
 * latest saved one), what's included, expiry, a label; the link is shown once, with Copy. Below, the BoQ's
 * links with their views and status; editing changes includes and expiry, never the token.
 */
export function ShareDialog({ boq, open, onOpenChange }: { boq: Boq; open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useTranslations("shares");
  const message = useErrorMessage();
  const systems = boq.currentRevision.currentRun?.classifications ?? [];
  const [mode, setMode] = useState<"pinned" | "latest_issued">("pinned");
  const [include, setInclude] = useState<ShareInclude>({ lineDetail: true, viewer: true, log: false, excel: false, ...(systems[0] ? { groupBy: systems[0].id } : {}) });
  const [expiry, setExpiry] = useState<Expiry>("30");
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const links = useShareLinks(boq.id, open);
  const create = useCreateShareLink(boq.id);

  const submit = () =>
    create.mutate(
      { mode, ...(mode === "pinned" ? { revisionId: boq.currentRevision.id } : {}), include, expiresAt: expiresAt(expiry), ...(label.trim() ? { label: label.trim() } : {}) },
      {
        onSuccess: (link) => {
          setCreated(link.url);
          setCopied(false);
          setLabel("");
        },
      },
    );
  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl" data-testid="share-dialog">
        <DialogHeader>
          <DialogTitle>{t("title", { name: boq.name })}</DialogTitle>
          <DialogDescription>{t("intro")}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <fieldset className="flex flex-col gap-1.5">
            <legend className="label-caps mb-1.5 text-muted-foreground">{t("what")}</legend>
            {(["pinned", "latest_issued"] as const).map((m) => (
              <label key={m} className="flex items-start gap-2">
                <input type="radio" name="share-mode" className="mt-1" checked={mode === m} onChange={() => setMode(m)} data-testid={`share-mode-${m}`} />
                <span>
                  {t(`mode.${m}`, { label: boq.currentRevision.label })}
                  <span className="block text-muted-foreground">{t(`modeHint.${m}`)}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <Includes value={include} onChange={setInclude} systems={systems} />
          <Field id="share-expiry" label={t("expires")}>
            <NativeSelect id="share-expiry" value={expiry} onChange={(e) => setExpiry(e.target.value as Expiry)} data-testid="share-expiry">
              {EXPIRY.map((e) => (
                <option key={e} value={e}>
                  {t(`expiry.${e}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="share-label" label={t("label")}>
            <Input id="share-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("labelPlaceholder")} data-testid="share-label" />
          </Field>
          <p className="text-muted-foreground sm:col-span-2">{t("anyone")}</p>
          {create.error ? (
            <p role="alert" className="text-error sm:col-span-2">
              {message(create.error)}
            </p>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={create.isPending} data-testid="share-create">
              {t("create")}
            </Button>
          </div>
        </form>
        {created && (
          <div className="flex flex-col gap-2 border-l-2 border-[var(--blue)] pl-3" data-testid="share-created">
            <p className="text-muted-foreground">{t("createdHint")}</p>
            <div className="flex items-center gap-2">
              <Input readOnly value={created} onFocus={(e) => e.currentTarget.select()} data-testid="share-url" />
              <Button variant="outline" onClick={copy} data-testid="share-copy">
                <Copy aria-hidden />
                {copied ? t("copied") : t("copy")}
              </Button>
            </div>
          </div>
        )}
        <section className="flex flex-col gap-2">
          <h3 className="label-caps">{t("links")}</h3>
          {links.data && links.data.length === 0 && <p className="text-muted-foreground">{t("noLinks")}</p>}
          {(links.data ?? []).map((l) => (
            <LinkRow key={l.id} link={l} systems={systems} />
          ))}
        </section>
      </DialogContent>
    </Dialog>
  );
}

/** One link of a list (the BoQ's, or the org's with its project and BoQ): status, what, views; edit and revoke as allowed. */
export function LinkRow({ link, systems = [], showBoq }: { link: ShareLink; systems?: { id: string; name: string }[]; showBoq?: boolean }) {
  const t = useTranslations("shares");
  const format = useFormatter();
  const relative = useRelativeTime();
  const message = useErrorMessage();
  const update = useUpdateShareLink();
  const revoke = useRevokeShareLink();
  const [editing, setEditing] = useState(false);
  const [include, setInclude] = useState<ShareInclude>(link.include);
  const [expiry, setExpiry] = useState<Expiry | "keep">("keep");
  const live = link.status === "active" || link.status === "suspended" || link.status === "expired";
  const included = (["lineDetail", "viewer", "log", "excel"] as const).filter((k) => link.include[k]).map((k) => t(`include.${k}`));

  return (
    <div className="flex flex-col gap-2 border-b border-border py-2" data-testid="share-link" data-status={link.status} data-label={link.label ?? ""}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold">{link.label ?? t("unlabelled")}</span>
        <span className="label-caps rounded-[var(--radius)] border border-border px-1" data-testid="share-status">
          {t(`status.${link.status}`)}
        </span>
        {showBoq && (
          <span className="text-muted-foreground">
            {link.projectName} · {link.boqName}
          </span>
        )}
        <span className="text-muted-foreground">
          {link.mode === "pinned" ? t("shows", { label: link.revisionLabel ?? "—" }) : t("follows", { label: link.revisionLabel ?? t("nothingSaved") })}
        </span>
      </div>
      <p className="text-muted-foreground">
        {[t("sheet"), ...included].join(", ")} · {t("by", { name: link.createdBy?.name ?? "" })} ·{" "}
        {link.expiresAt ? t("expiresOn", { date: format.dateTime(new Date(link.expiresAt), { dateStyle: "medium" }) }) : t("noExpiry")} ·{" "}
        <span data-testid="share-views">{t("views", { count: link.views ?? 0, when: link.lastViewedAt ? relative(link.lastViewedAt) : "" })}</span>
      </p>
      {live && (
        <div className="flex flex-wrap gap-2">
          {link.permissions?.edit && link.status !== "expired" && (
            <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)} data-testid="share-edit">
              {t("edit")}
            </Button>
          )}
          {link.permissions?.revoke && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm" data-testid="share-revoke">
                  {t("revoke")}
                </Button>
              }
              title={t("revokeTitle")}
              body={t("revokeBody")}
              confirm={t("revoke")}
              destructive
              onConfirm={() => revoke.mutateAsync(link.id)}
              testId="share-revoke-confirm"
            />
          )}
        </div>
      )}
      {editing && (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({ id: link.id, include, ...(expiry !== "keep" ? { expiresAt: expiresAt(expiry) } : {}) }, { onSuccess: () => setEditing(false) });
          }}
        >
          <Includes value={include} onChange={setInclude} systems={systems} />
          <Field id={`share-expiry-${link.id}`} label={t("expires")}>
            <NativeSelect id={`share-expiry-${link.id}`} value={expiry} onChange={(e) => setExpiry(e.target.value as Expiry | "keep")}>
              <option value="keep">{t("keepExpiry")}</option>
              {EXPIRY.map((e) => (
                <option key={e} value={e}>
                  {t(`expiry.${e}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={update.isPending} data-testid="share-save">
              {t("save")}
            </Button>
          </div>
        </form>
      )}
      {(update.error ?? revoke.error) ? (
        <p role="alert" className="text-error">
          {message(update.error ?? revoke.error)}
        </p>
      ) : null}
    </div>
  );
}
