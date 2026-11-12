"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import { useMe } from "@/api/hooks/me";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LOCALE_COOKIE, LOCALES } from "@/i18n/config";

/** S04: my name and language, my organisations, leaving one (F01). */
export default function AccountPage() {
  const t = useTranslations("account");
  const roles = useTranslations("common.roles");
  const message = useErrorMessage();
  const me = useMe();
  const client = useQueryClient();
  const [leaveError, setLeaveError] = useState<{ orgId: string; text: string } | null>(null);
  const leave = useMutation({
    mutationFn: async (orgId: string) => api.DELETE("/orgs/{orgId}/members/{userId}", { params: { path: { orgId, userId: me.data!.user.id } } }),
    onSuccess: async () => {
      setLeaveError(null);
      await client.invalidateQueries({ queryKey: keys.me() });
    },
    onError: (e, orgId) => setLeaveError({ orgId, text: message(e) }),
  });

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-8 py-10">
      <Link href="/" aria-label={t("home")}>
        <Wordmark />
      </Link>
      <h1 className="text-title">{t("title")}</h1>
      {me.data && <ProfileForm user={me.data.user} />}
      <section className="flex flex-col gap-3">
        <h2 className="label-caps">{t("orgs")}</h2>
        {me.data?.memberships.length === 0 && <p className="text-muted-foreground">{t("noOrgs")}</p>}
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {me.data?.memberships.map((m) => (
            <li key={m.org.id} className="flex flex-col gap-1 py-2" data-testid={`account-org-${m.org.slug}`}>
              <div className="flex items-center gap-4">
                <Link href={`/${m.org.slug}`} className="flex-1 hover:underline">
                  {m.org.name}
                </Link>
                <span className="label-caps text-muted-foreground">{roles(m.role)}</span>
                <Button variant="ghost" onClick={() => leave.mutate(m.org.id)} data-testid={`leave-${m.org.slug}`}>
                  {t("leave")}
                </Button>
              </div>
              {leaveError?.orgId === m.org.id && (
                <p role="alert" className="text-error">
                  {leaveError.text}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

/** Name and language, starting from the server's values. */
function ProfileForm({ user }: { user: { name: string; email: string; locale: string } }) {
  const t = useTranslations("account");
  const message = useErrorMessage();
  const client = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [locale, setLocale] = useState(user.locale);

  const save = useMutation({
    mutationFn: async () => (await api.PATCH("/me", { body: { name: name.trim(), locale } })).data!,
    onSuccess: async (user) => {
      document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(user.locale)}; path=/; max-age=31536000; samesite=lax`;
      toast(t("saved"));
      await client.invalidateQueries({ queryKey: keys.me() });
      router.refresh();
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
      <h2 className="label-caps">{t("profile")}</h2>
      <Field id="account-name" label={t("name")}>
        <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="account-name" />
      </Field>
      <Field id="account-email" label={t("email")} hint={t("emailHint")}>
        <Input id="account-email" value={user.email} readOnly />
      </Field>
      <Field id="account-locale" label={t("language")}>
        <NativeSelect id="account-locale" value={locale} onChange={(e) => setLocale(e.target.value)} data-testid="account-locale">
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {t(`languages.${l}`)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {save.error && (
        <p role="alert" className="text-error">
          {message(save.error)}
        </p>
      )}
      <div>
        <Button type="submit" disabled={!name.trim() || save.isPending} data-testid="account-save">
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
