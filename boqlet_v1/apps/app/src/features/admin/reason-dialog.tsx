"use client";

import { useState, type ReactElement, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/**
 * Every admin action needs a reason (F19 §4): the dialog asks for the action's own fields and the
 * reason, and stays open until the action succeeds. Errors are told by the app's global handler.
 */
export function ReasonDialog({
  trigger,
  title,
  body,
  children,
  submit,
  onSubmit,
  canSubmit = true,
  testId,
  destructive,
}: {
  trigger: ReactElement;
  title: ReactNode;
  body?: ReactNode;
  children?: ReactNode;
  submit: ReactNode;
  onSubmit: (reason: string) => Promise<unknown>;
  canSubmit?: boolean;
  testId: string;
  destructive?: boolean;
}) {
  const t = useTranslations("admin.org");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = canSubmit && reason.trim().length > 0 && !busy;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) setReason("");
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent data-testid={`${testId}-dialog`}>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!ok) return;
            setBusy(true);
            try {
              await onSubmit(reason.trim());
              setOpen(false);
              setReason("");
            } catch {
              // told by the global error handler; the dialog stays open
            } finally {
              setBusy(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {body && <DialogDescription>{body}</DialogDescription>}
          </DialogHeader>
          {children}
          <Field id={`${testId}-reason`} label={t("reason")} hint={t("reasonHint")}>
            <Input id={`${testId}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} required data-testid={`${testId}-reason`} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={!ok} data-testid={`${testId}-submit`}>
              {submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
