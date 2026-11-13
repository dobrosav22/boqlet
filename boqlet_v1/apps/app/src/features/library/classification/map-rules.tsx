"use client";

/**
 * Advanced › Rules by condition (the PoC's `MapTab`, `MatchLeaf`, `ItemsPicker`, `TargetEditor`):
 * map rules for what one code per BoQ item cannot say. The rules the Codes per line table writes
 * are listed too, read-only here. Conditions are text the engine parses (BR-01).
 */
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { ClassificationMap, CodeTarget, LineMatch, MapRule } from "@ifc-boq/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { move, put, removeAt, replaceAt, uniqueId } from "../shared/doc";
import { ExprInput, Field, LazyText, LogicTree, Num, Options, RowList, Section, Select, StringList, Text, TextArea, inputClass, linkButton, matches, type RowInfo } from "../shared/fields";
import { cap } from "../shared/story";
import { LINE_FIELDS, MANUAL_KINDS } from "../shared/vocab";
import { CodePicker } from "./class-table";
import { useClassWords } from "./class-story";
import { asList, targetCodes, type LineKind } from "./model";
import { NavLink } from "./nav";

type LeafKind = "ruleId" | "tag" | "manualKind" | "where";
const LEAF_KINDS = ["ruleId", "tag", "manualKind", "where"] as const satisfies readonly LeafKind[];
const leafKind = (m: LineMatch): LeafKind => ("ruleId" in m ? "ruleId" : "tag" in m ? "tag" : "manualKind" in m ? "manualKind" : "where");
const oneOrMany = (l: string[] | undefined) => (!l || l.length === 0 ? "" : l.length === 1 ? l[0]! : l);
/** An example condition, shown with readable names (a formula, not a sentence). */
const WHERE_EXAMPLE = 'ifc_class = "IfcWall" AND UNDER(element_type, "wall.partition")';
const TEMPLATES: Record<LeafKind, LineMatch> = { ruleId: { ruleId: "" }, tag: { tag: "" }, manualKind: { manualKind: "preliminary" }, where: { where: "" } };

function MatchLeaf({ value, onChange, kinds, itemLabel }: { value: LineMatch; onChange: (v: LineMatch) => void; kinds: LineKind[]; itemLabel: (id: string) => string }) {
  const t = useTranslations("classificationEditor.rules");
  const tags = [...new Set(kinds.flatMap((k) => k.tags))].sort();
  return (
    <div className="flex min-w-0 flex-col gap-1 md:flex-row md:items-start">
      <div className="md:w-64 md:shrink-0">
        <Select value={leafKind(value)} options={LEAF_KINDS} labels={(k) => t(`leaf.${k}`)} onChange={(k) => onChange(TEMPLATES[k ?? "where"])} aria-label={t("conditionType")} />
      </div>
      <div className="min-w-0 flex-1">
        {"ruleId" in value && <ItemsPicker ids={asList(value.ruleId).filter(Boolean)} onChange={(v) => onChange({ ruleId: oneOrMany(v) })} kinds={kinds} itemLabel={itemLabel} />}
        {"tag" in value && <StringList values={asList(value.tag).filter(Boolean)} onChange={(v) => onChange({ tag: oneOrMany(v) })} suggestions={tags} placeholder={t("tagsPlaceholder")} />}
        {"manualKind" in value && <StringList values={asList(value.manualKind).filter(Boolean)} onChange={(v) => onChange({ manualKind: oneOrMany(v) })} suggestions={MANUAL_KINDS} />}
        {"where" in value && <ExprInput value={value.where} onChange={(v) => onChange({ where: v ?? "" })} placeholder={WHERE_EXAMPLE} />}
      </div>
    </div>
  );
}

/** BoQ items by name, as chips, with a select to add one. */
function ItemsPicker({ ids, onChange, kinds, itemLabel }: { ids: string[]; onChange: (ids: string[]) => void; kinds: LineKind[]; itemLabel: (id: string) => string }) {
  const t = useTranslations("classificationEditor.rules");
  return (
    <div className="flex flex-wrap items-center gap-1">
      {ids.map((id) => (
        <span key={id} className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-border px-1.5 py-0.5" title={id}>
          {itemLabel(id)}
          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={t("removeItem", { item: itemLabel(id) })} onClick={() => onChange(ids.filter((x) => x !== id))}>
            ×
          </button>
        </span>
      ))}
      <select className={cn(inputClass, "w-auto")} value="" onChange={(e) => e.target.value && onChange([...ids, e.target.value])} aria-label={t("addItem")}>
        <option value="">{ids.length ? t("anotherItem") : t("pickItem")}</option>
        {kinds
          .filter((k) => !ids.includes(k.id))
          .map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
      </select>
    </div>
  );
}

type TargetMode = "fixed" | "lookup" | "source";

function TargetEditor({ value, onChange }: { value: CodeTarget; onChange: (v: CodeTarget) => void }) {
  const t = useTranslations("classificationEditor.rules");
  const mode: TargetMode = typeof value === "string" ? "fixed" : "fromSource" in value ? "source" : "lookup";
  const fieldsId = useId();
  return (
    <>
      <Field label={t("codeIs")}>
        <Select
          value={mode}
          options={["fixed", "lookup", "source"] as const}
          labels={(m) => t(`targetModes.${m}`)}
          onChange={(m) => onChange(m === "lookup" ? { lookup: "material", table: {} } : m === "source" ? { fromSource: true } : "")}
        />
      </Field>
      {typeof value === "string" && (
        <Field label={t("code")} group>
          <CodePicker value={value} onChange={(v) => onChange(v ?? "")} aria-label={t("code")} />
        </Field>
      )}
      {typeof value === "object" && "fromSource" in value && <p className="col-span-full text-muted-foreground">{t("fromSourceHint")}</p>}
      {typeof value === "object" && "table" in value && (
        <>
          <Field label={t("lookUp")}>
            <Text mono list={fieldsId} value={value.lookup} onChange={(v) => onChange({ ...value, lookup: v ?? "" })} optional={false} />
            <Options id={fieldsId} values={LINE_FIELDS} />
          </Field>
          <Field label={t("notInTable")} group>
            <CodePicker value={value.default} onChange={(v) => onChange(put(value, "default", v))} aria-label={t("notInTable")} />
          </Field>
          <div className="col-span-full flex flex-col gap-1">
            <span className="label-caps text-muted-foreground">{t("valueToCode")}</span>
            {Object.entries(value.table).map(([k, code], i, all) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] items-start gap-2">
                <LazyText mono value={k} aria-label={t("value")} onCommit={(nk) => onChange({ ...value, table: Object.fromEntries(all.map((r, j) => (j === i ? [nk, r[1]] : r))) })} />
                <CodePicker value={code} onChange={(c) => onChange({ ...value, table: { ...value.table, [k]: c ?? "" } })} aria-label={t("codeForValue", { value: k })} />
                <button type="button" className="h-8 text-muted-foreground hover:text-foreground" aria-label={t("removeValue", { value: k })} onClick={() => onChange({ ...value, table: Object.fromEntries(all.filter((_, j) => j !== i)) })}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className={cn(linkButton, "self-start")} onClick={() => onChange({ ...value, table: { ...value.table, [`value${Object.keys(value.table).length + 1}`]: "" } })}>
              {t("addRow")}
            </button>
          </div>
        </>
      )}
    </>
  );
}

export function MapTab({ map, onChange, titles, table, initial, kinds, itemLabel, onTable }: {
  map: ClassificationMap;
  onChange: (m: ClassificationMap) => void;
  titles: Map<string, string>;
  /** Indexes of the rules the Codes per line table writes. */
  table: Set<number>;
  initial: number | null;
  kinds: LineKind[];
  itemLabel: (id: string) => string;
  onTable: () => void;
}) {
  const t = useTranslations("classificationEditor.rules");
  const w = useClassWords();
  const rules = map.rules;
  const firstOwn = rules.findIndex((_, i) => !table.has(i));
  const [sel, setSel] = useState<number | null>(initial ?? (firstOwn >= 0 ? firstOwn : null));
  const [q, setQ] = useState("");
  const setRules = (r: MapRule[]) => onChange({ ...map, rules: r });
  const rule = sel !== null ? rules[sel] : undefined;
  const set = (r: MapRule) => sel !== null && setRules(replaceAt(rules, sel, r));
  const fromTable = sel !== null && table.has(sel);
  const row = (r: MapRule, i: number): RowInfo => ({
    key: String(i),
    title: w.short(r.code, titles),
    sub: r.priority ? t("rowSubPriority", { what: w.match(r.match, itemLabel), priority: r.priority }) : w.match(r.match, itemLabel),
    badge: targetCodes(r.code).some((c) => c && !titles.has(c)) ? { text: t("unknownCode"), tone: "removed" as const } : undefined,
  });
  const shown = rules.map((r, i) => ({ r, i })).filter(({ r }) => matches(q, r.id, w.match(r.match, itemLabel), w.short(r.code, titles)));
  const rows: RowInfo[] = [
    ...shown.filter(({ i }) => !table.has(i)).map(({ r, i }) => ({ ...row(r, i), section: t("sectionOwn") })),
    ...shown.filter(({ i }) => table.has(i)).map(({ r, i }) => ({ ...row(r, i), section: t("sectionTable") })),
  ];
  const priority = rule?.priority ?? 0;

  return (
    <div className="flex flex-col gap-4" data-testid="class-rules">
      <p className="text-muted-foreground">{t("hint", { ask: map.onConflict === "ask" ? "yes" : "no" })}</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(16rem,1fr)_minmax(0,2fr)]">
        <RowList
          rows={rows}
          selected={sel === null ? null : String(sel)}
          onSelect={(k) => setSel(Number(k))}
          onAdd={() => {
            setRules([...rules, { id: uniqueId("rule", rules.map((r) => r.id)), match: { ruleId: "" }, code: "" }]);
            setSel(rules.length);
          }}
          addLabel={t("add")}
          filter={q}
          onFilter={setQ}
          empty={t("empty")}
        />
        <div className="flex min-w-0 flex-col gap-3">
          {!rule && <p className="text-muted-foreground">{t("select")}</p>}
          {rule && sel !== null && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {fromTable ? (
                  <>
                    <span className="text-muted-foreground">{t("fromTable")}</span>
                    <NavLink onClick={onTable}>{t("openTable")}</NavLink>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="outline" disabled={sel === 0} onClick={() => (setRules(move(rules, sel, -1)), setSel(sel - 1))}>
                      {t("moveUp")}
                    </Button>
                    <Button type="button" variant="outline" disabled={sel === rules.length - 1} onClick={() => (setRules(move(rules, sel, 1)), setSel(sel + 1))}>
                      {t("moveDown")}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        setRules(removeAt(rules, sel));
                        setSel(null);
                      }}
                    >
                      {t("delete")}
                    </Button>
                  </>
                )}
              </div>
              <div className="prose-text flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-card p-3" data-testid="rule-story">
                <p>{t.rich("sentence", { what: cap(w.match(rule.match, itemLabel)), code: w.code(rule.code, titles), b: (c) => <b>{c}</b> })}</p>
                <p className="text-muted-foreground">{t("prioritySentence", { priority, wins: priority >= 5 ? "yes" : "no", hasNote: rule.note ? "yes" : "no", note: rule.note ?? "" })}</p>
              </div>
              <fieldset className="min-w-0" disabled={fromTable}>
                <div className={cn("flex flex-col gap-4", fromTable && "opacity-70")}>
                  <Section title={t("whichLines")}>
                    <div className="col-span-full">
                      <LogicTree<LineMatch>
                        value={rule.match}
                        onChange={(m) => set({ ...rule, match: m })}
                        newLeaf={() => ({ where: "" })}
                        renderLeaf={(l, s) => <MatchLeaf value={l} onChange={s} kinds={kinds} itemLabel={itemLabel} />}
                      />
                    </div>
                    <p className="col-span-full text-muted-foreground">{t("conditionHint")}</p>
                  </Section>
                  <Section title={t("whichCode")}>
                    <TargetEditor value={rule.code} onChange={(c) => set({ ...rule, code: c })} />
                  </Section>
                  <Section title={t("severalApply")}>
                    <Field label={t("priority")} hint={t("priorityHint")}>
                      <Num value={rule.priority} onChange={(v) => set(put(rule, "priority", v))} step={1} placeholder="0" />
                    </Field>
                  </Section>
                  <details className="rounded-[var(--radius)] border border-border p-3">
                    <summary className="cursor-pointer">{t("moreOptions")}</summary>
                    <div className="mt-3">
                      <Section title={t("labels")}>
                        <Field label={t("note")} wide>
                          <TextArea value={rule.note} onChange={(v) => set(put(rule, "note", v))} rows={2} />
                        </Field>
                        <Field label={t("id")}>
                          <Text mono value={rule.id} onChange={(v) => set({ ...rule, id: v ?? "" })} optional={false} />
                        </Field>
                      </Section>
                    </div>
                  </details>
                </div>
              </fieldset>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
