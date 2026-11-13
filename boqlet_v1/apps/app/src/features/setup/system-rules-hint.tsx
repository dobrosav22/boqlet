"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Run } from "@/api/hooks/boqs";
import { usePreset, usePresetVersion } from "@/api/hooks/library";
import { useOrg } from "@/features/orgs/org-context";

const KEY = (userId: string) => `boqlet-system-rules-hint:${userId}`;

/**
 * F16 "When it appears" §3: on a sheet generated with the system rules, one line pointing to the setup
 * wizard. Dismissible per user (this browser; the contract has no user preferences besides email).
 */
export function SystemRulesHint({ run, userId }: { run: Run; userId: string | undefined }) {
  const t = useTranslations("setup");
  const { org, can } = useOrg();
  const [hidden, setHidden] = useState(() => {
    try {
      return !!userId && window.localStorage.getItem(KEY(userId)) === "1";
    } catch {
      return false;
    }
  });
  const version = usePresetVersion(run.snapshotVersions?.ruleSetVersionId, undefined);
  const preset = usePreset(version.data?.presetId ?? "");
  if (hidden || !version.data || preset.data?.layer !== "system") return null;
  return (
    <p className="flex items-center gap-3 text-muted-foreground" data-testid="system-rules-hint">
      {can("finishSetup") ? (
        <Link href={`/${org.slug}/setup`} className="text-link hover:underline">
          {t("hint")}
        </Link>
      ) : (
        <span>{t("hint")}</span>
      )}
      <button
        type="button"
        className="hover:text-foreground"
        onClick={() => {
          setHidden(true);
          try {
            if (userId) window.localStorage.setItem(KEY(userId), "1");
          } catch {
            /* storage blocked */
          }
        }}
      >
        {t("hintDismiss")}
      </button>
    </p>
  );
}
