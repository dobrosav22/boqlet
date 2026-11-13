"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * A question before an action that can't be taken back: the dialog stays open while the action runs
 * and closes when it succeeds (the registry's `AlertDialogAction` is a plain button that never closes).
 */
export function ConfirmDialog({
  trigger,
  title,
  body,
  confirm,
  onConfirm,
  testId,
  destructive,
}: {
  trigger: ReactElement;
  title: ReactNode;
  body: ReactNode;
  confirm: ReactNode;
  onConfirm: () => Promise<unknown>;
  testId?: string;
  destructive?: boolean;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            data-testid={testId}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                setOpen(false);
              } catch {
                // The mutation's own error handling has told the person; the dialog stays open.
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
