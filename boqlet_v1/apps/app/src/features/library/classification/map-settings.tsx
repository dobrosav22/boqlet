"use client";

/**
 * Advanced › Where codes come from (the PoC's `MapSettings`): the order of the sources of a line's
 * code, the IFC classification names, what happens when nothing gives a code or rules disagree,
 * and "About this map".
 */
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ClassificationMap } from "@ifc-boq/types";
import { cn } from "@/lib/utils";
import { move, put, type ClassificationDoc } from "../shared/doc";
import { Field, Section, Select, StringList, Text, linkButton } from "../shared/fields";
import { CodePicker } from "./class-table";

const SOURCES = ["decision", "map", "ifc"] as const;
const iconButton = "h-8 w-8 rounded-[var(--radius)] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40";

export function MapSettings({ doc, onChange, titles }: { doc: ClassificationDoc; onChange: (d: ClassificationDoc) => void; titles: Map<string, string> }) {
  const t = useTranslations("classificationEditor.settings");
  const { map } = doc;
  const setMap = (m: ClassificationMap) => onChange({ ...doc, map: m });
  const sources = map.sources ?? ["decision", "map"];
  const unmapped = typeof map.onUnmapped === "string" ? map.onUnmapped : "code";
  return (
    <div className="flex flex-col gap-4" data-testid="class-settings">
      <Section title={t("order")} hint={t("orderHint")}>
        <div className="col-span-full flex flex-col gap-1">
          <ol className="flex flex-col gap-1">
            {sources.map((s, i) => (
              <li key={s} className="flex items-center gap-2 border-b border-border py-1">
                <span className="w-6 text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="flex-1">{t(`sources.${s}`)}</span>
                <button type="button" className={iconButton} aria-label={t("earlier")} disabled={i === 0} onClick={() => setMap({ ...map, sources: move(sources, i, -1) })}>
                  <ArrowUp className="mx-auto size-4" aria-hidden />
                </button>
                <button type="button" className={iconButton} aria-label={t("later")} disabled={i === sources.length - 1} onClick={() => setMap({ ...map, sources: move(sources, i, 1) })}>
                  <ArrowDown className="mx-auto size-4" aria-hidden />
                </button>
                <button type="button" className={iconButton} aria-label={t("doNotUse", { source: t(`sources.${s}`) })} disabled={sources.length === 1} onClick={() => setMap({ ...map, sources: sources.filter((x) => x !== s) })}>
                  ×
                </button>
              </li>
            ))}
          </ol>
          {SOURCES.filter((s) => !sources.includes(s)).map((s) => (
            <button key={s} type="button" className={cn(linkButton, "self-start")} onClick={() => setMap({ ...map, sources: [...sources, s] })}>
              {t("addSource", { source: t(`sources.${s}`) })}
            </button>
          ))}
        </div>
        {sources.includes("ifc") && (
          <>
            <Field label={t("ifcNames")} group hint={t("ifcNamesHint")}>
              <StringList values={map.ifc?.systemNames} onChange={(v) => setMap({ ...map, ifc: { agreement: map.ifc?.agreement ?? "majority", systemNames: v ?? [] } })} />
            </Field>
            <Field label={t("agreement")}>
              <Select
                value={map.ifc?.agreement}
                options={["all", "majority", "ask"] as const}
                labels={(a) => t(`agreements.${a}`)}
                onChange={(v) => setMap({ ...map, ifc: { systemNames: map.ifc?.systemNames ?? [], agreement: v ?? "majority" } })}
              />
            </Field>
          </>
        )}
      </Section>
      <Section title={t("nothing")}>
        <Field label={t("theLine")}>
          <Select
            value={unmapped}
            options={["flag", "ask", "code"] as const}
            labels={(u) => t(`unmapped.${u}`)}
            onChange={(v) => setMap({ ...map, onUnmapped: v === "code" ? { code: titles.keys().next().value ?? "" } : (v ?? "flag") })}
            data-testid="class-unmapped"
          />
        </Field>
        {typeof map.onUnmapped === "object" && (
          <Field label={t("defaultCode")} group>
            <CodePicker value={map.onUnmapped.code} onChange={(c) => setMap({ ...map, onUnmapped: { code: c ?? "" } })} aria-label={t("defaultCode")} />
          </Field>
        )}
        <Field label={t("conflict")}>
          <Select value={map.onConflict} options={["first", "ask"] as const} labels={(c) => t(`conflicts.${c}`)} onChange={(v) => setMap({ ...map, onConflict: v ?? "first" })} />
        </Field>
      </Section>
      <details className="rounded-[var(--radius)] border border-border p-3">
        <summary className="cursor-pointer">{t("aboutMap")}</summary>
        <div className="mt-3">
          <Section title={t("theMap")} hint={t("theMapHint")}>
            <Field label={t("name")}>
              <Text value={map.name} onChange={(v) => setMap({ ...map, name: v ?? "" })} optional={false} />
            </Field>
            <Field label={t("id")}>
              <Text mono value={map.id} onChange={(v) => setMap({ ...map, id: v ?? "" })} optional={false} />
            </Field>
            <Field label={t("version")}>
              <Text value={map.version} onChange={(v) => setMap({ ...map, version: v ?? "" })} optional={false} />
            </Field>
            <Field label={t("extends")} hint={t("extendsHint")}>
              <Text mono value={map.extends} onChange={(v) => setMap(put(map, "extends", v))} placeholder={t("none")} />
            </Field>
          </Section>
        </div>
      </details>
    </div>
  );
}
