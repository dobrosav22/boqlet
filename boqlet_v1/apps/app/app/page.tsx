"use client";

import { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMe } from "@/api/hooks/me";
import { makeQueryClient } from "@/api/query-client";
import { useSession } from "@/auth";
import { Wordmark } from "@/components/shell/wordmark";
import { lastOrg } from "@/features/orgs/org-context";

/**
 * Where people land after sign-in (F01 §3): their only org, the last one they used, a picker when
 * there are several, or onboarding when there are none. Invitations come back through `returnTo`.
 */
export default function Home() {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      <StartRedirect />
    </QueryClientProvider>
  );
}

function StartRedirect() {
  const t = useTranslations("orgs.start");
  const router = useRouter();
  const session = useSession();
  const me = useMe();
  const memberships = me.data?.memberships ?? [];
  const last = typeof window === "undefined" ? null : lastOrg();
  const target =
    memberships.length === 1 ? memberships[0]!.org.slug : memberships.find((m) => m.org.slug === last)?.org.slug ?? null;

  useEffect(() => {
    if (session.status === "anonymous") router.replace("/sign-in");
    else if (me.data && memberships.length === 0) router.replace("/onboarding");
    else if (target) router.replace(`/${target}`);
  }, [session.status, me.data, memberships.length, target, router]);

  const pick = me.data && memberships.length > 1 && !target;
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 px-8" aria-busy={!pick}>
      <Wordmark className="text-display" />
      {pick && (
        <nav aria-label={t("pick")} className="flex flex-col gap-2" data-testid="org-picker">
          <p className="label-caps text-muted-foreground">{t("pick")}</p>
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {memberships.map((m) => (
              <li key={m.org.id}>
                <Link href={`/${m.org.slug}`} className="flex h-10 items-center hover:bg-accent">
                  {m.org.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </main>
  );
}
