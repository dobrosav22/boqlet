"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Schemas } from "@ifc-boq/api";
import { api } from "@/api/client";
import { isApiError } from "@/api/errors";
import { keys } from "@/api/keys";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { rememberOrg, useOrg } from "@/features/orgs/org-context";
import { SLUG_PATTERN } from "@/features/orgs/slug";

type Settings = NonNullable<Schemas["Org"]["settings"]>;
const THOUSANDS = [" ", " ", ",", ".", "'", ""] as const;

/** S21: rename, address, defaults for new projects, formats, sharing and approval (F01, F15, F09). */
export function GeneralSettings() {
  const t = useTranslations("settings.general");
  const message = useErrorMessage();
  const { org, can } = useOrg();
  const editable = can("editOrgSettings");
  const client = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);
  const [settings, setSettings] = useState<Settings>({ ...org.settings });
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((s) => ({ ...s, [key]: value }));

  const save = useMutation({
    mutationFn: async () => (await api.PATCH("/orgs/{orgId}", { params: { path: { orgId: org.id } }, body: { name, slug, settings } })).data!,
    onSuccess: async (updated) => {
      toast(t("saved"));
      await client.invalidateQueries({ queryKey: keys.me() });
      if (updated.slug !== org.slug) {
        rememberOrg(updated.slug);
        router.replace(`/${updated.slug}/settings/general`);
      }
    },
    onError: () => {},
  });
  const slugTaken = isApiError(save.error) && save.error.code === "slug_taken";

  return (
    <div className="flex max-w-2xl flex-col gap-10">
      {!editable && (
        <p className="text-muted-foreground" data-testid="read-only-note">
          {t("readOnly")}
        </p>
      )}
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <fieldset disabled={!editable || save.isPending} className="flex flex-col gap-6">
          <section className="flex flex-col gap-4">
            <h2 className="label-caps">{t("identity")}</h2>
            <Field id="org-name" label={t("name")}>
              <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="settings-name" />
            </Field>
            <Field id="org-slug" label={t("slug")} hint={t("slugHint")} error={slugTaken ? t("slugTaken") : !SLUG_PATTERN.test(slug) ? t("slugInvalid") : undefined}>
              <Input id="org-slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
            </Field>
          </section>
          <section className="flex flex-col gap-4">
            <h2 className="label-caps">{t("defaults")}</h2>
            <div className="grid grid-cols-3 gap-4">
              <Field id="org-currency" label={t("currency")}>
                <Input id="org-currency" value={settings.defaultCurrency ?? ""} maxLength={3} onChange={(e) => set("defaultCurrency", e.target.value.toUpperCase())} />
              </Field>
              <Field id="org-country" label={t("country")}>
                <Input id="org-country" value={settings.defaultCountry ?? ""} maxLength={2} onChange={(e) => set("defaultCountry", e.target.value.toUpperCase())} />
              </Field>
              <Field id="org-units" label={t("units")}>
                <NativeSelect id="org-units" value={settings.defaultUnitSystem ?? "metric"} onChange={(e) => set("defaultUnitSystem", e.target.value as "metric" | "imperial")}>
                  <option value="metric">{t("metric")}</option>
                  <option value="imperial">{t("imperial")}</option>
                </NativeSelect>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field id="org-decimal" label={t("decimal")}>
                <NativeSelect id="org-decimal" value={settings.numberFormat?.decimal ?? "."} onChange={(e) => set("numberFormat", { ...settings.numberFormat, decimal: e.target.value as "." | "," })}>
                  <option value=".">{t("decimalPoint")}</option>
                  <option value=",">{t("decimalComma")}</option>
                </NativeSelect>
              </Field>
              <Field id="org-thousands" label={t("thousands")}>
                <NativeSelect
                  id="org-thousands"
                  value={settings.numberFormat?.thousands ?? " "}
                  onChange={(e) => set("numberFormat", { ...settings.numberFormat, thousands: e.target.value as (typeof THOUSANDS)[number] })}
                >
                  {THOUSANDS.map((sep) => (
                    <option key={sep || "none"} value={sep}>
                      {t(`thousandsSep.${["thin", "space", "comma", "point", "apostrophe", "none"][THOUSANDS.indexOf(sep)]}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="org-date" label={t("dateFormat")} hint={t("dateFormatHint")}>
                <Input id="org-date" value={settings.dateFormat ?? ""} onChange={(e) => set("dateFormat", e.target.value)} />
              </Field>
            </div>
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="label-caps">{t("workflow")}</h2>
            <Toggle id="org-links" checked={settings.publicLinksAllowed ?? true} onChange={(v) => set("publicLinksAllowed", v)} label={t("publicLinks")} />
            <Toggle id="org-approval" checked={settings.approvalRequired ?? false} onChange={(v) => set("approvalRequired", v)} label={t("approval")} />
            <Toggle id="org-four-eyes" checked={settings.fourEyes ?? false} onChange={(v) => set("fourEyes", v)} label={t("fourEyes")} disabled={!settings.approvalRequired} />
          </section>
          {save.error && !slugTaken && (
            <p role="alert" className="text-error">
              {message(save.error)}
            </p>
          )}
          {editable && (
            <div>
              <Button type="submit" disabled={!SLUG_PATTERN.test(slug) || !name.trim()} data-testid="settings-save">
                {t("save")}
              </Button>
            </div>
          )}
        </fieldset>
      </form>
      {can("deleteOrg") && <DeleteOrg />}
    </div>
  );
}

function Toggle({ id, label, checked, onChange, disabled }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label htmlFor={id} className="flex items-center gap-3">
      <input id={id} type="checkbox" className="size-4 accent-[var(--foreground)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function DeleteOrg() {
  const t = useTranslations("settings.general.delete");
  const message = useErrorMessage();
  const { org } = useOrg();
  const client = useQueryClient();
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const remove = useMutation({
    mutationFn: async () => api.DELETE("/orgs/{orgId}", { params: { path: { orgId: org.id } }, body: { confirmName: confirm } }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: keys.me() });
      router.replace("/");
    },
    onError: () => {},
  });
  return (
    <section className="flex flex-col gap-3 border-t border-[var(--status-error)] pt-6">
      <h2 className="label-caps text-error">{t("title")}</h2>
      <p className="prose-text text-muted-foreground">{t("body")}</p>
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="destructive" className="self-start" />}>{t("open")}</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmTitle", { org: org.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Input aria-label={t("typeName")} placeholder={org.name} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {remove.error && (
            <p role="alert" className="text-error">
              {message(remove.error)}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={confirm !== org.name} onClick={() => remove.mutate()}>
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
