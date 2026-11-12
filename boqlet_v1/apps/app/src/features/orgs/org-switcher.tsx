"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMe } from "@/api/hooks/me";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { rememberOrg, useOrg } from "./org-context";

/** The org switcher in the top bar (F01): the URL carries the org slug. */
export function OrgSwitcher() {
  const t = useTranslations("orgs.switcher");
  const { org } = useOrg();
  const me = useMe();
  const router = useRouter();
  const memberships = me.data?.memberships ?? [];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" data-testid="org-switcher" aria-label={t("label")} />}>
        <span className="max-w-48 truncate">{org.name}</span>
        <ChevronsUpDownIcon className="text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="label-caps">{t("label")}</DropdownMenuLabel>
          {memberships.map((m) => (
            <DropdownMenuItem
              key={m.org.id}
              data-testid={`switch-org-${m.org.slug}`}
              onClick={() => {
                rememberOrg(m.org.slug);
                router.push(`/${m.org.slug}`);
              }}
            >
              <span className="flex-1 truncate">{m.org.name}</span>
              {m.org.id === org.id && <CheckIcon aria-label={t("current")} />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/onboarding" />}>{t("create")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
