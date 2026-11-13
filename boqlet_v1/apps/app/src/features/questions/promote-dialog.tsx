"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePresets } from "@/api/hooks/boqs";
import { usePromote } from "@/api/hooks/decisions";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * F05 §6: a library editor copies name answers into one of the org's dictionaries; each becomes an
 * entry of a new published version. The project decisions stay as they are.
 */
export function PromoteDialog({ orgId, projectId, decisionIds, open, onOpenChange }: { orgId: string; projectId: string; decisionIds: string[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("questions.promote");
  const message = useErrorMessage();
  const presets = usePresets(orgId, projectId);
  const promote = usePromote(projectId);
  const dictionaries = (presets.data ?? []).filter((p) => p.kind === "dictionary" && p.layer === "org" && !p.archived && p.permissions?.edit);
  const [chosen, setChosen] = useState("");
  const target = chosen || dictionaries[0]?.id || "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="promote-dialog">
        <DialogHeader>
          <DialogTitle>{t("title", { count: decisionIds.length })}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>
        {presets.isSuccess && dictionaries.length === 0 ? (
          <p className="text-muted-foreground" data-testid="promote-none">
            {t("none")}
          </p>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="label-caps text-muted-foreground">{t("dictionary")}</span>
            <NativeSelect value={target} onChange={(e) => setChosen(e.target.value)} data-testid="promote-target">
              {dictionaries.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        {promote.error ? (
          <p role="alert" className="text-error">
            {message(promote.error)}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!target || promote.isPending}
            onClick={() => promote.mutate({ decisionIds, dictionaryPresetId: target }, { onSuccess: () => onOpenChange(false) })}
            data-testid="promote-confirm"
          >
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
