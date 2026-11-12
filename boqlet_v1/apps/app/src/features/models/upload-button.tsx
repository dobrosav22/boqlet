"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { Schemas } from "@ifc-boq/api";
import { isApiError } from "@/api/errors";
import { usePlans } from "@/api/hooks/models";
import { DimensionRule } from "@/components/dimension-rule";
import { useErrorMessage } from "@/components/errors/use-error-message";
import { Button } from "@/components/ui/button";
import { useOrg } from "@/features/orgs/org-context";
import { checkFile, uploadModelVersion } from "./upload";

/** Choose an IFC file, check it, upload it with progress (F03 §2). */
export function UploadButton({
  modelId,
  label,
  onUploaded,
  variant = "default",
}: {
  modelId: string;
  label: string;
  onUploaded?: (version: Schemas["ModelVersion"]) => void;
  variant?: "default" | "outline";
}) {
  const t = useTranslations("models.upload");
  const message = useErrorMessage();
  const { org } = useOrg();
  const plans = usePlans();
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [share, setShare] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const maxMb = plans.data?.find((p) => p.id === org.planId)?.entitlements.maxModelVersionMb;

  async function upload(file: File) {
    setError(null);
    const problem = checkFile(file, maxMb);
    if (problem) return setError(problem === "not_ifc" ? t("notIfc") : t("tooLarge", { max: maxMb ?? 0 }));
    setShare(0);
    try {
      const version = await uploadModelVersion(modelId, file, setShare);
      await Promise.all([client.invalidateQueries({ queryKey: ["models"] }), client.invalidateQueries({ queryKey: ["modelVersions"] }), client.invalidateQueries({ queryKey: ["model", modelId] })]);
      onUploaded?.(version);
    } catch (e) {
      // 402 opens the limit dialog through the global handler; the rest is said here.
      if (!(isApiError(e) && e.status === 402)) setError(message(e));
    } finally {
      setShare(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept=".ifc"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
        data-testid={`upload-input-${modelId}`}
      />
      <Button variant={variant} onClick={() => input.current?.click()} disabled={share !== null} data-testid={`upload-${modelId}`}>
        {label}
      </Button>
      {share !== null && <DimensionRule progress={share} label={t("uploading", { pct: Math.round(share * 100) })} className="max-w-64" />}
      {error && (
        <p role="alert" className="text-error" data-testid="upload-error">
          {error}
        </p>
      )}
    </div>
  );
}
