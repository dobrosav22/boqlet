"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import type { Boq } from "@/api/hooks/boqs";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Reopen a confirmed BoQ (F09 §6, lead): a reason is required and audited; a new working version is
 * carried over from the last saved one. F08 §1's "Reopen to update" opens it with its own intro.
 */
export function ReopenBoqDialog({ boq, open, onOpenChange, forUpdate }: { boq: Boq; open: boolean; onOpenChange: (open: boolean) => void; forUpdate?: boolean }) {
  const t = useTranslations("boqs.reopen");
  const message = useErrorMessage();
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const reopen = useMutation({
    mutationFn: async () => (await api.POST("/boqs/{boqId}/reopen", { params: { path: { boqId: boq.id } }, body: { reason: reason.trim() } })).data!,
    onSuccess: async (next) => {
      client.setQueryData(keys.boq(boq.id), next);
      await Promise.all([client.invalidateQueries({ queryKey: keys.boq(boq.id) }), client.invalidateQueries({ queryKey: keys.boqs(boq.projectId) }), client.invalidateQueries({ queryKey: ["runs"] })]);
      setReason("");
      onOpenChange(false);
    },
    onError: () => {},
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !reopen.isPending && onOpenChange(next)}>
      <DialogContent data-testid="reopen-boq-dialog">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim()) reopen.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("title", { name: boq.name })}</DialogTitle>
            <DialogDescription>{forUpdate ? t("forUpdate") : t("description")}</DialogDescription>
          </DialogHeader>
          <Field id="reopen-reason" label={t("reason")} error={reopen.error ? message(reopen.error) : undefined}>
            <textarea
              id="reopen-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              autoFocus
              className="rounded-[var(--radius)] border border-input bg-transparent px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="reopen-reason"
            />
          </Field>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>{t("cancel")}</DialogClose>
            <Button type="submit" disabled={!reason.trim() || reopen.isPending} data-testid="reopen-submit">
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
