import Link from "next/link";
import { useTranslations } from "next-intl";
import { DimensionRule } from "@/components/dimension-rule";

/** The 404 page body: for unknown routes and for API 404s on a page's main resource. */
export function NotFoundView() {
  const t = useTranslations("common.notFound");
  return (
    <div className="flex flex-col gap-4 py-16" data-testid="not-found">
      <p className="label-caps text-muted-foreground">{t("code")}</p>
      <h1 className="text-title">{t("title")}</h1>
      <p className="prose-text text-muted-foreground">{t("body")}</p>
      <DimensionRule className="max-w-sm" />
      <Link href="/" className="text-link underline-offset-4 hover:underline">
        {t("home")}
      </Link>
    </div>
  );
}
