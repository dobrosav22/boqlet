"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/api/client";
import { isApiError } from "@/api/errors";
import { keys } from "@/api/keys";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { DimensionRule } from "@/components/dimension-rule";
import { describedBy, Field } from "@/components/field";
import { Poster } from "@/components/poster";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rememberOrg } from "@/features/orgs/org-context";
import { SLUG_PATTERN, suggestSlug } from "@/features/orgs/slug";

/** S02: create the firm's organisation (F01 §4). The setup wizard follows from FE-028 on. */
export default function OnboardingPage() {
  const t = useTranslations("orgs.onboarding");
  const message = useErrorMessage();
  const router = useRouter();
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [currency, setCurrency] = useState("");
  const [country, setCountry] = useState("");
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric");
  const effectiveSlug = slugEdited ? slug : suggestSlug(name);

  const create = useMutation({
    mutationFn: async () => {
      const settings = {
        defaultUnitSystem: unitSystem,
        ...(currency ? { defaultCurrency: currency.toUpperCase() } : {}),
        ...(country ? { defaultCountry: country.toUpperCase() } : {}),
      };
      return (await api.POST("/orgs", { body: { name: name.trim(), slug: effectiveSlug, settings } })).data!;
    },
    onSuccess: async (org) => {
      rememberOrg(org.slug);
      await client.invalidateQueries({ queryKey: keys.me() });
      router.push(`/${org.slug}`);
    },
    onError: () => {},
  });

  const slugTaken = isApiError(create.error) && create.error.code === "slug_taken";
  const slugInvalid = effectiveSlug !== "" && !SLUG_PATTERN.test(effectiveSlug);
  const otherError = create.error && !slugTaken ? message(create.error) : null;

  return (
    <main className="mx-auto grid min-h-dvh max-w-5xl grid-cols-1 items-center gap-12 px-8 py-12 md:grid-cols-[1fr_320px]">
      <form
        className="flex max-w-xl flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && !slugInvalid) create.mutate();
        }}
      >
        <Wordmark />
        <div className="flex flex-col gap-3">
          <p className="label-caps text-muted-foreground">{t("step")}</p>
          <h1 className="display text-display-sm">{t("title")}</h1>
          <p className="prose-text text-muted-foreground">{t("intro")}</p>
        </div>
        <Field id="org-name" label={t("name")}>
          <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus data-testid="org-name" />
        </Field>
        <Field
          id="org-slug"
          label={t("slug")}
          hint={t("slugHint", { slug: effectiveSlug || "…" })}
          error={slugTaken ? t("slugTaken") : slugInvalid ? t("slugInvalid") : undefined}
        >
          <Input
            id="org-slug"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value.toLowerCase());
            }}
            aria-describedby={describedBy("org-slug", slugTaken || slugInvalid)}
            aria-invalid={slugTaken || slugInvalid || undefined}
            data-testid="org-slug"
          />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field id="org-currency" label={t("currency")} hint={t("optional")}>
            <Input id="org-currency" value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value)} />
          </Field>
          <Field id="org-country" label={t("country")} hint={t("optional")}>
            <Input id="org-country" value={country} maxLength={2} onChange={(e) => setCountry(e.target.value)} />
          </Field>
          <Field id="org-units" label={t("units")}>
            <select
              id="org-units"
              className="h-8 rounded-[var(--radius)] border border-input bg-transparent px-2"
              value={unitSystem}
              onChange={(e) => setUnitSystem(e.target.value as "metric" | "imperial")}
            >
              <option value="metric">{t("metric")}</option>
              <option value="imperial">{t("imperial")}</option>
            </select>
          </Field>
        </div>
        {otherError && (
          <p role="alert" className="text-error">
            {otherError}
          </p>
        )}
        <div className="flex flex-col gap-3">
          <DimensionRule progress={name.trim() ? 0.5 : 0.1} />
          <div>
            <Button type="submit" disabled={!name.trim() || slugInvalid || create.isPending} data-testid="create-org">
              {t("create")}
            </Button>
          </div>
        </div>
      </form>
      <Poster variant={0} className="hidden w-full md:grid" />
    </main>
  );
}
