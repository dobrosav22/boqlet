"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/api/client";
import { isApiError } from "@/api/errors";
import { keys } from "@/api/keys";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOrg } from "@/features/orgs/org-context";

/** S06: a new project; currency, units and language default to the org's (F02 §1). */
export default function NewProjectPage() {
  const t = useTranslations("projects.new");
  const message = useErrorMessage();
  const { org } = useOrg();
  const router = useRouter();
  const client = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    code: "",
    client: "",
    country: org.settings.defaultCountry ?? "",
    address: "",
    currency: org.settings.defaultCurrency ?? "",
    unitSystem: (org.settings.defaultUnitSystem ?? "metric") as "metric" | "imperial",
  });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const create = useMutation({
    mutationFn: async () => {
      const opt = (v: string) => (v.trim() ? v.trim() : undefined);
      const body = {
        name: form.name.trim(),
        code: opt(form.code),
        client: opt(form.client),
        currency: opt(form.currency.toUpperCase()),
        unitSystem: form.unitSystem,
        ...(opt(form.country) || opt(form.address) ? { location: { country: opt(form.country.toUpperCase()), address: opt(form.address) } } : {}),
      };
      return (await api.POST("/orgs/{orgId}/projects", { params: { path: { orgId: org.id } }, body })).data!;
    },
    onSuccess: async (project) => {
      await client.invalidateQueries({ queryKey: keys.projects(org.id) });
      router.push(`/${org.slug}/projects/${project.id}`);
    },
    onError: () => {},
  });
  const limit = isApiError(create.error) && create.error.status === 402;

  return (
    <form
      className="flex max-w-2xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (form.name.trim()) create.mutate();
      }}
    >
      <h1 className="text-title">{t("title")}</h1>
      <Field id="project-name" label={t("name")}>
        <Input id="project-name" value={form.name} onChange={set("name")} required autoFocus data-testid="project-name" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field id="project-code" label={t("code")} hint={t("optional")}>
          <Input id="project-code" value={form.code} onChange={set("code")} />
        </Field>
        <Field id="project-client" label={t("client")} hint={t("optional")}>
          <Input id="project-client" value={form.client} onChange={set("client")} />
        </Field>
      </div>
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <Field id="project-address" label={t("address")} hint={t("optional")}>
          <Input id="project-address" value={form.address} onChange={set("address")} />
        </Field>
        <Field id="project-country" label={t("country")} hint={t("optional")}>
          <Input id="project-country" value={form.country} maxLength={2} onChange={set("country")} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field id="project-currency" label={t("currency")}>
          <Input id="project-currency" value={form.currency} maxLength={3} onChange={set("currency")} />
        </Field>
        <Field id="project-units" label={t("units")}>
          <NativeSelect id="project-units" value={form.unitSystem} onChange={set("unitSystem")}>
            <option value="metric">{t("metric")}</option>
            <option value="imperial">{t("imperial")}</option>
          </NativeSelect>
        </Field>
      </div>
      <p className="prose-text text-muted-foreground">{t("defaultsNote")}</p>
      {create.error && !limit && (
        <p role="alert" className="text-error">
          {message(create.error)}
        </p>
      )}
      <div>
        <Button type="submit" disabled={!form.name.trim() || create.isPending} data-testid="create-project">
          {t("create")}
        </Button>
      </div>
    </form>
  );
}
