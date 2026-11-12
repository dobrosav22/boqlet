"use client";

import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/api/hooks/me";
import { useAuth, useSession } from "@/auth";
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

/** The signed-in user's menu in the top bar. FE-005 adds the account page and the org switcher. */
export function UserMenu() {
  const t = useTranslations("shell.user");
  const auth = useAuth();
  const session = useSession();
  const client = useQueryClient();
  const me = useMe();
  if (session.status !== "authenticated") return null;
  // The server's view of the user (GET /me) wins over what the sign-in remembered.
  const name = me.data?.user.name ?? session.name;
  const email = me.data?.user.email ?? session.email;
  const initials = (name ?? email ?? "?")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" aria-label={t("menu")} data-testid="user-menu" />}>
        <span className="grid size-6 place-items-center rounded-full bg-foreground text-label text-background" aria-hidden>
          {initials}
        </span>
        <span className="hidden sm:inline" data-testid="user-name">
          {name}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col">
            <span>{name}</span>
            <span className="text-muted-foreground">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid="sign-out"
          onClick={() => {
            client.clear();
            void auth.signOut();
          }}
        >
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
