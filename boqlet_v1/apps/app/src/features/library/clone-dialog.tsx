"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreatePreset, type Preset } from "@/api/hooks/library";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { presetHref } from "./kinds";

/**
 * Clone (F10 §2, P19): every preset can be cloned into the org's Library. A rule set is cloned as an
 * independent copy (unaffected by later changes to the original) or "based on it" (a patch that stores
 * only the differences and follows the original's future versions); classifications and dictionaries
 * are copied. The clone opens as a draft named "{name} (copy)".
 */
export function CloneDialog({ preset, orgId, orgSlug }: { preset: Preset; orgId: string; orgSlug: string }) {
  const t = useTranslations("library.clone");
  const message = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"copy" | "patch">("patch");
  const create = useCreatePreset(orgId);
  const from = preset.latestPublishedVersion?.id ?? preset.draft?.id;
  if (!from) return null;
  const isRuleSet = preset.kind === "rule_set";
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setName(t("copyName", { name: preset.name }));
          setMode(isRuleSet ? "patch" : "copy");
          create.reset();
          setOpen(true);
        }}
        data-testid="preset-clone"
      >
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="clone-dialog">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              create.mutate(
                { kind: preset.kind, name: name.trim(), ...(preset.basedOn ? { basedOn: preset.basedOn } : {}), start: { mode: isRuleSet ? mode : "copy", fromVersionId: from } },
                { onSuccess: (clone) => router.push(presetHref(orgSlug, clone)) },
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("title", { name: preset.name })}</DialogTitle>
              <DialogDescription>{t(isRuleSet ? "bodyRuleSet" : "body")}</DialogDescription>
            </DialogHeader>
            <Field id="clone-name" label={t("name")} error={create.error ? message(create.error) : undefined}>
              <Input id="clone-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="clone-name" />
            </Field>
            {isRuleSet && (
              <fieldset className="flex flex-col gap-2">
                <legend className="label-caps mb-1.5 text-muted-foreground">{t("how")}</legend>
                {(["patch", "copy"] as const).map((m) => (
                  <label key={m} className="flex items-start gap-2">
                    <input type="radio" name="clone-mode" className="mt-1" checked={mode === m} onChange={() => setMode(m)} data-testid={`clone-${m}`} />
                    <span className="flex flex-col">
                      <span>{t(`modes.${m}`)}</span>
                      <span className="text-muted-foreground">{t(`modeHints.${m}`)}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>{t("cancel")}</DialogClose>
              <Button type="submit" disabled={!name.trim() || create.isPending} data-testid="clone-confirm">
                {t("confirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
