"use client";

/**
 * The BoQ items tab, ported from the PoC's `RuleSetEditor.tsx` (`ItemsTab`): everything that
 * becomes a BoQ line, in one list of three kinds (measured from the model, calculated from other
 * items, entered by hand), with the selected one's form beside it.
 */
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ItemRule } from "@ifc-boq/types";
import { Button } from "@/components/ui/button";
import { move, removeAt, replaceAt, uniqueId } from "../shared/doc";
import { RowList, matches, type RowInfo } from "../shared/fields";
import { NewItemStarter } from "./item-forms";
import type { Row, Status } from "./model";
import { NavLink } from "./nav";

export type Entry = { id: string };
export type GroupKey = "model" | "calculated" | "manual";
export interface GroupOf<T extends Entry> {
  key: GroupKey;
  rows: Row<T>[];
  own: T[];
  setOwn: (l: T[]) => void;
  /** Set the list after an entry's id changed from `from`, updating what refers to it. Default: setOwn. */
  rename?: (from: string, l: T[]) => void;
  /** Base for new ids. */
  noun: string;
  make: (id: string) => T;
  summary: (e: T) => { title: string; sub: string };
  form: (e: T, set: (e: T) => void) => ReactNode;
}
export type Group = GroupOf<Entry>;
export const group = <T extends Entry>(g: GroupOf<T>) => g as unknown as Group;

const BADGE_TONE: Record<Status, NonNullable<RowInfo["badge"]>["tone"] | null> = { own: null, new: "new", inherited: "inherited", changed: "changed", removed: "removed" };

export function ItemsTab({ groups, initial, patch, removed, setRemoved, counts }: {
  groups: Group[];
  initial: string | null;
  patch: boolean;
  removed: string[];
  setRemoved: (ids: string[]) => void;
  counts?: Record<string, number>;
}) {
  const t = useTranslations("ruleSetEditor.items");
  const keys = groups.flatMap((g) => g.rows.map((r) => `${g.key}:${r.id}`));
  const [sel, setSel] = useState<string | null>(initial && keys.includes(initial) ? initial : (keys[0] ?? null));
  const [starting, setStarting] = useState(false);
  const [q, setQ] = useState("");
  const g = groups.find((x) => sel?.startsWith(`${x.key}:`));
  const row = g?.rows.find((r) => `${g.key}:${r.id}` === sel) ?? null;
  const ownIndex = g && row ? g.own.findIndex((e) => e.id === row.id) : -1;
  const model = groups.find((x) => x.key === "model")!;

  const create = (to: Group, entry: Entry) => {
    const id = uniqueId(entry.id || to.noun, to.rows.map((r) => r.id));
    to.setOwn([...to.own, { ...entry, id }]);
    setSel(`${to.key}:${id}`);
    setStarting(false);
  };
  const add = (to: Group) => {
    if (to.key === "model") return setStarting(true);
    create(to, to.make(""));
  };
  const select = (k: string) => {
    setStarting(false);
    setSel(k);
  };
  const update = (e: Entry) => {
    if (!g || !row) return;
    if (e.id === row.id) return g.setOwn(replaceAt(g.own, ownIndex, e));
    if (!e.id.trim() || g.rows.some((r) => r.id === e.id)) return; // empty or taken: keep the old id
    (g.rename ?? ((_from: string, l: Entry[]) => g.setOwn(l)))(row.id, replaceAt(g.own, ownIndex, e));
    setSel(`${g.key}:${e.id}`);
  };
  const editable = row && (row.status === "own" || row.status === "new" || row.status === "changed");

  const rowInfos: RowInfo[] = groups.flatMap((x) =>
    x.rows
      .filter((r) => matches(q, r.id, x.summary(r.entry).title, x.summary(r.entry).sub))
      .map((r) => {
        const tone = BADGE_TONE[r.status];
        return {
          key: `${x.key}:${r.id}`,
          ...x.summary(r.entry),
          badge: tone ? { text: t(`badge.${r.status}`), tone } : undefined,
          section: t("groupCount", { title: t(`groups.${x.key}.title`), n: x.rows.filter((y) => y.status !== "removed").length }),
        };
      }),
  );
  const tools = (
    <span className="flex flex-wrap gap-1">
      {groups.map((x) => (
        <Button key={x.key} type="button" variant="outline" size="sm" onClick={() => add(x)} title={t(`groups.${x.key}.hint`)} data-testid={`add-${x.key}`}>
          {t(`groups.${x.key}.add`)}
        </Button>
      ))}
    </span>
  );

  return (
    <div className="flex flex-col gap-4" data-testid="items-tab">
      <p className="max-w-[72ch] text-muted-foreground">{t.rich("intro", { b: (c) => <b className="text-foreground">{c}</b> })}</p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(16rem,1fr)_minmax(0,2fr)]">
        <RowList rows={rowInfos} selected={starting ? null : sel} onSelect={select} filter={q} onFilter={setQ} tools={tools} />
        <div className="flex min-w-0 flex-col gap-3">
          {starting && (
            <NewItemStarter
              counts={counts}
              existing={model.rows.filter((r) => r.status !== "removed").map((r) => ({ id: r.id, label: (r.entry as ItemRule).label || r.id, entry: r.entry as ItemRule }))}
              onCreate={(e) => create(model, e)}
              onEmpty={() => create(model, model.make(""))}
              onCancel={() => setStarting(false)}
            />
          )}
          {!starting && (!g || !row) && <p className="text-muted-foreground">{t("selectOne")}</p>}
          {!starting && g && row && (
            <>
              <p className="text-muted-foreground">{t("groupHead", { title: t(`groups.${g.key}.title`), hint: t(`groups.${g.key}.hint`) })}</p>
              <div className="flex flex-wrap items-center gap-2" data-testid="item-actions" data-status={row.status}>
                {row.status === "inherited" && (
                  <>
                    <span className="text-muted-foreground">{t("inheritedNote")}</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => g.setOwn([...g.own, structuredClone(row.entry)])} data-testid="change-here">
                      {t("changeHere")}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setRemoved([...removed, row.id])} data-testid="leave-out">
                      {t("leaveOut")}
                    </Button>
                  </>
                )}
                {row.status === "removed" && (
                  <>
                    <span className="text-muted-foreground">{t("removedNote")}</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => setRemoved(removed.filter((x) => x !== row.id))} data-testid="bring-back">
                      {t("bringBack")}
                    </Button>
                  </>
                )}
                {row.status === "changed" && (
                  <>
                    <span className="text-muted-foreground">{t("changedNote")}</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => g.setOwn(removeAt(g.own, ownIndex))} data-testid="back-to-inherited">
                      {t("backToInherited")}
                    </Button>
                  </>
                )}
                {(row.status === "own" || row.status === "new") && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const id = uniqueId(`${row.id}-copy`, g.rows.map((r) => r.id));
                        g.setOwn([...g.own, { ...structuredClone(row.entry), id }]);
                        setSel(`${g.key}:${id}`);
                      }}
                    >
                      {t("duplicate")}
                    </Button>
                    {row.status === "own" && (
                      <>
                        <Button type="button" variant="outline" size="sm" disabled={ownIndex === 0} onClick={() => g.setOwn(move(g.own, ownIndex, -1))}>
                          {t("moveUp")}
                        </Button>
                        <Button type="button" variant="outline" size="sm" disabled={ownIndex === g.own.length - 1} onClick={() => g.setOwn(move(g.own, ownIndex, 1))}>
                          {t("moveDown")}
                        </Button>
                      </>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-error"
                      data-testid="delete-item"
                      onClick={() => {
                        g.setOwn(removeAt(g.own, ownIndex));
                        setSel(null);
                      }}
                    >
                      {t("delete")}
                    </Button>
                  </>
                )}
              </div>
              <fieldset className="min-w-0 disabled:opacity-80" disabled={!editable}>
                {g.form(row.entry, update)}
              </fieldset>
            </>
          )}
        </div>
      </div>
      {patch && removed.length > 0 && (
        <p className="text-muted-foreground">
          {t("leftOut")}{" "}
          {removed.map((id, i) => (
            <span key={id}>
              {i > 0 && t("listSeparator")}
              {keys.some((k) => k.endsWith(`:${id}`)) ? <NavLink onClick={() => select(keys.find((k) => k.endsWith(`:${id}`))!)}>{id}</NavLink> : id}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
