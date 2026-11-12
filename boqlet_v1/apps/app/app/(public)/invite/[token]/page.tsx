"use client";

import { use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import { useAuth, useSession } from "@/auth";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Poster } from "@/components/poster";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";
import { rememberOrg } from "@/features/orgs/org-context";

/** S03: accept an invitation (F01 §6). The signed-in email must match the invited one. */
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const t = useTranslations("orgs.invite");
  const roles = useTranslations("common.roles");
  const message = useErrorMessage();
  const auth = useAuth();
  const session = useSession();
  const router = useRouter();
  const client = useQueryClient();
  const returnTo = `/invite/${token}`;

  const preview = useQuery({
    queryKey: ["invitation", token],
    queryFn: async () => (await api.GET("/invitations/{token}", { params: { path: { token } } })).data!,
    throwOnError: false,
    retry: false,
  });

  const accept = useMutation({
    mutationFn: async () => {
      const before = new Set(((await api.GET("/me")).data?.memberships ?? []).map((m) => m.org.id));
      await api.POST("/invitations/{token}/accept", { params: { path: { token } } });
      const after = (await api.GET("/me")).data!;
      return after.memberships.find((m) => !before.has(m.org.id))?.org.slug ?? null;
    },
    onSuccess: async (slug) => {
      await client.invalidateQueries({ queryKey: keys.me() });
      if (slug) rememberOrg(slug);
      router.push(slug ? `/${slug}` : "/");
    },
    onError: () => {},
  });

  const inv = preview.data;
  const emailMismatch =
    session.status === "authenticated" && inv && session.email && session.email.toLowerCase() !== inv.email.toLowerCase();

  return (
    <main className="mx-auto grid min-h-dvh max-w-5xl grid-cols-1 items-center gap-12 px-8 py-12 md:grid-cols-[1fr_280px]">
      <div className="flex max-w-xl flex-col gap-6" data-testid="invitation">
        <Wordmark />
        {preview.isPending && <p className="text-muted-foreground">{t("loading")}</p>}
        {preview.isError && (
          <p role="alert" className="prose-text">
            {t("notFound")}
          </p>
        )}
        {inv && (
          <>
            <div className="flex flex-col gap-3">
              <p className="label-caps text-muted-foreground">{t("label")}</p>
              <h1 className="display text-display-sm">{t("title", { org: inv.orgName })}</h1>
              <p className="prose-text">{t("body", { email: inv.email, role: roles.has(inv.role) ? roles(inv.role) : inv.role })}</p>
            </div>
            {inv.status !== "pending" && (
              <p role="alert" className="prose-text" data-testid="invitation-status">
                {t(`status.${inv.status}`)}
              </p>
            )}
            {inv.status === "pending" && session.status === "anonymous" && (
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground">{t("signInFirst")}</p>
                <div>
                  <Button onClick={() => void auth.signIn({ returnTo, email: inv.email })} data-testid="invite-sign-in">
                    {t("signIn")}
                  </Button>
                </div>
              </div>
            )}
            {inv.status === "pending" && emailMismatch && (
              <div className="flex flex-col gap-3" data-testid="email-mismatch">
                <p role="alert" className="prose-text">
                  {t("mismatch", { signedIn: session.email ?? "", invited: inv.email })}
                </p>
                <div>
                  <Button variant="outline" onClick={() => void auth.signOut({ returnTo })}>
                    {t("otherAccount")}
                  </Button>
                </div>
              </div>
            )}
            {inv.status === "pending" && session.status === "authenticated" && !emailMismatch && (
              <div className="flex flex-col gap-2">
                {accept.error && (
                  <p role="alert" className="text-error">
                    {message(accept.error)}
                  </p>
                )}
                <div>
                  <Button onClick={() => accept.mutate()} disabled={accept.isPending} data-testid="accept-invitation">
                    {t("accept")}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <Poster variant={1} className="hidden w-full md:grid" />
    </main>
  );
}
