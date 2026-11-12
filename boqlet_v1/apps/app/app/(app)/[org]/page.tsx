import { useTranslations } from "next-intl";

/** Placeholder: the dashboard (S05) is built in FE-006. */
export default function DashboardPage() {
  const t = useTranslations("common.dashboard");
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-title">{t("title")}</h1>
      <p className="prose-text text-muted-foreground">{t("placeholder")}</p>
    </div>
  );
}
