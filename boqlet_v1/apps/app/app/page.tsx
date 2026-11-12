"use client";

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMe } from "@/api/hooks/me";
import { makeQueryClient } from "@/api/query-client";
import { useSession } from "@/auth";
import { Wordmark } from "@/components/shell/wordmark";

/** The start page sends people where they belong: sign-in, or their (first) org. */
export default function Home() {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      <StartRedirect />
    </QueryClientProvider>
  );
}

function StartRedirect() {
  const t = useTranslations("common.home");
  const router = useRouter();
  const session = useSession();
  const me = useMe();

  useEffect(() => {
    if (session.status === "anonymous") router.replace("/sign-in");
    const first = me.data?.memberships[0]?.org.slug;
    if (first) router.replace(`/${first}`);
  }, [session.status, me.data, router]);

  const noOrg = me.data && me.data.memberships.length === 0;
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 px-8" aria-busy={!noOrg}>
      <Wordmark className="text-display" />
      <p className="label-caps text-muted-foreground">{t("title")}</p>
      {noOrg && <p className="prose-text">{t("noOrg")}</p>}
    </main>
  );
}
