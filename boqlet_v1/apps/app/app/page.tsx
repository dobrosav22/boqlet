import Link from "next/link";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";

/** Start page. FE-004 sends signed-in users to their org and everyone else to sign-in. */
export default function Home() {
  const t = useTranslations("common.home");
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 px-8">
      <Wordmark className="text-display" />
      <p className="label-caps text-muted-foreground">{t("title")}</p>
      <p className="prose-text">{t("body")}</p>
      <div>
        <Button render={<Link href="/sign-in" />} nativeButton={false}>
          {t("signIn")}
        </Button>
      </div>
    </main>
  );
}
