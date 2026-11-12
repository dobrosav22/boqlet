import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/shell/wordmark";

/** Placeholder: the auth adapter's sign-in page arrives in FE-004. */
export default function SignInPage() {
  const t = useTranslations("common.signIn");
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 px-8">
      <Wordmark className="text-display-sm" />
      <h1 className="text-title">{t("title")}</h1>
      <p className="prose-text text-muted-foreground">{t("placeholder")}</p>
    </main>
  );
}
