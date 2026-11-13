"use client";

/**
 * Advanced › About and defaults, ported from the PoC's `RuleSetEditor.tsx` (`Overview`,
 * `ScopeEditor`): identity, about, what the BoQ leaves out, and the defaults every rule falls back to.
 *
 * In the product a patch's parent is fixed by the version it was created on, so "Extends" is shown,
 * not picked (the PoC's picker over rule-set ids is gone).
 */
import { useTranslations } from "next-intl";
import type { OurRuleType, RuleSet, Selector } from "@ifc-boq/types";
import { cn } from "@/lib/utils";
import { isPatch, put, removeAt, replaceAt } from "../shared/doc";
import { Field, Section, Select, Text, TextArea, linkButton } from "../shared/fields";
import { useVocab } from "../shared/use-vocab";
import { BREAKDOWNS } from "../shared/vocab";
import type { Slots } from "./model";
import { OnMissingEditor, RemoveButton, RoundingEditor, SelectorEditor } from "./rule-parts";

/** A language code, as an example (code, not words). */
const LOCALE_EXAMPLE = "en";

export function Overview({ doc, onChange, slots, parent }: { doc: OurRuleType; onChange: (d: OurRuleType) => void; slots: Slots; parent: RuleSet | null }) {
  const t = useTranslations("ruleSetEditor.about");
  const vocab = useVocab();
  const meta = doc.meta ?? {};
  const setMeta = (k: string, v: string | undefined) => onChange({ ...doc, meta: put(meta as Record<string, string>, k, v) } as OurRuleType);
  const defaults = doc.defaults ?? {};
  const setDefaults = (d: typeof defaults) => onChange(put(doc, "defaults", Object.keys(d).length ? d : undefined) as OurRuleType);
  const patch = isPatch(doc);
  return (
    <div className="flex flex-col gap-6" data-testid="rule-set-about">
      <Section title={t("identity")}>
        <Field label={t("name")}>
          <Text value={doc.name} onChange={(v) => onChange({ ...doc, name: v ?? "" })} optional={false} />
        </Field>
        <Field label={t("id")} hint={t("idHint")}>
          <Text mono value={doc.id} onChange={(v) => onChange({ ...doc, id: v ?? "" })} optional={false} />
        </Field>
        <Field label={t("version")}>
          <Text value={doc.version} onChange={(v) => onChange({ ...doc, version: v ?? "" })} optional={false} />
        </Field>
        {patch && (
          <Field label={t("extends")} group hint={t("extendsHint")}>
            <span className="flex h-8 items-center gap-2" data-testid="extends">
              <code>{doc.extends}</code>
              {parent?.name && <span className="text-muted-foreground">{parent.name}</span>}
            </span>
          </Field>
        )}
      </Section>
      <Section title={t("about")} hint={patch ? t("aboutPatchHint") : undefined}>
        <Field label={t("description")} wide>
          <TextArea value={meta.description} onChange={(v) => setMeta("description", v)} />
        </Field>
        <Field label={t("basedOn")} hint={t("basedOnHint")}>
          <Text value={meta.basedOn} onChange={(v) => setMeta("basedOn", v)} />
        </Field>
        <Field label={t("author")}>
          <Text value={meta.author} onChange={(v) => setMeta("author", v)} />
        </Field>
        <Field label={t("locale")}>
          <Text value={meta.locale} onChange={(v) => setMeta("locale", v)} placeholder={LOCALE_EXAMPLE} />
        </Field>
        <Field label={t("unitSystem")}>
          <Select value={meta.unitSystem} options={["metric", "imperial"] as const} labels={(o) => t(`unitSystems.${o}`)} empty={patch ? t("fromParent") : undefined} onChange={(v) => setMeta("unitSystem", v)} />
        </Field>
      </Section>
      <ScopeEditor doc={doc} onChange={onChange} slots={slots} />
      <Section title={t("defaults")} hint={t("defaultsHint")}>
        <RoundingEditor value={defaults.rounding} onChange={(v) => setDefaults(put(defaults, "rounding", v))} slots={slots} inherit={patch ? t("parentDefault") : t("engineDefault")} />
        <OnMissingEditor value={defaults.onMissing} onChange={(v) => setDefaults(put(defaults, "onMissing", v))} slots={slots} empty={patch ? t("fromParent") : t("flagDefault")} />
        <Field label={t("breakdown")}>
          <Select value={defaults.breakdown} options={BREAKDOWNS} labels={(o) => vocab.words("breakdowns", o)} empty={patch ? t("fromParent") : vocab.words("breakdowns", "element")} onChange={(v) => setDefaults(put(defaults, "breakdown", v))} />
        </Field>
      </Section>
    </div>
  );
}

/** What the BoQ leaves out (RuleSet.scope): each condition drops the elements it matches. */
function ScopeEditor({ doc, onChange, slots }: { doc: OurRuleType; onChange: (d: OurRuleType) => void; slots: Slots }) {
  const t = useTranslations("ruleSetEditor.about");
  const patch = isPatch(doc);
  const own = doc.scope;
  const list = own?.exclude ?? [];
  const set = (l: Selector[] | undefined) => onChange(put(doc, "scope", l === undefined ? undefined : { exclude: l }) as OurRuleType);
  return (
    <Section title={t("leftOut")} hint={t("leftOutHint")}>
      <div className="col-span-full flex flex-col gap-2" data-testid="scope-editor">
        {patch && own === undefined ? (
          <p className="text-muted-foreground">
            {t("asParent")}{" "}
            <button type="button" className={linkButton} onClick={() => set([])}>
              {t("setHere")}
            </button>
          </p>
        ) : (
          <>
            {list.length === 0 && <p className="text-muted-foreground">{t("nothingLeftOut")}</p>}
            {list.map((sel, i) => (
              <div key={i} className="flex items-start gap-2 rounded-[var(--radius)] border border-border p-2">
                <div className="min-w-0 flex-1">
                  <SelectorEditor value={sel} onChange={(v) => set(replaceAt(list, i, v))} slots={slots} />
                </div>
                <RemoveButton label={t("removeCondition")} onClick={() => set(removeAt(list, i))} />
              </div>
            ))}
            <div className="flex gap-3">
              <button type="button" className={linkButton} onClick={() => set([...list, { field: "status", op: "in", value: ["existing", "demolish"] }])}>
                {t("addLeaveOut")}
              </button>
              {patch && (
                <button type="button" className={cn(linkButton)} onClick={() => set(undefined)}>
                  {t("backToParent")}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Section>
  );
}
