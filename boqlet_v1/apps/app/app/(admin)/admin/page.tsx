import { useTranslations } from "next-intl";

/** Placeholder: the admin console is built in FE-038. */
export default function AdminPage() {
  const t = useTranslations("common.admin");
  return (
    <main className="mx-auto max-w-3xl px-8 py-16">
      <h1 className="text-title">{t("title")}</h1>
      <p className="prose-text text-muted-foreground">{t("placeholder")}</p>
    </main>
  );
}
