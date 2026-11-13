"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { OurRuleType, Param, RuleSet, RuleSetPatch } from "@ifc-boq/types";
import type { Preset } from "@/api/hooks/library";
import { Button } from "@/components/ui/button";
import { answerParams, effectiveSlots, type OwnParams } from "@/features/library/rule-set/model";
import { Answer } from "@/features/library/rule-set/questions-tab";
import { isPatch } from "@/features/library/shared/doc";
import type { Draft } from "@/features/library/shared/use-draft";
import { cn } from "@/lib/utils";
import { measureScreens, missingAnswers, sectionTitle, type Screen } from "./steps";

/**
 * F16 step 1 "How you measure": the checklist of what the BoQ includes (1a), a detail screen for each
 * switch turned on (1b), and the measuring screens the rule set marks (1c), one topic per screen with the
 * Settings tab's controls. Every answer goes into the rule-set draft (only differences are stored on a
 * patch) and the preview beside it follows each save.
 */
export function MeasureStep({ preset, draft, orgSlug, onDone, screenIndex, onScreen }: {
  preset: Preset;
  draft: Draft<unknown>;
  orgSlug: string;
  onDone: () => void;
  screenIndex: number;
  onScreen: (i: number) => void;
}) {
  const t = useTranslations("setup.measure");
  const doc = draft.doc as OurRuleType | undefined;
  const patch = !!doc && isPatch(doc);
  const parent = draft.parent;
  const [tried, setTried] = useState(false);

  const rs = useMemo<RuleSet | null>(() => {
    if (!doc) return null;
    if (!patch) return doc as RuleSet;
    if (!parent) return null;
    return { ...parent, params: effectiveSlots(doc, parent), setupSteps: (doc as RuleSetPatch).setupSteps ?? parent.setupSteps };
  }, [doc, parent, patch]);
  if (!doc || !rs) return <div aria-busy="true" className="h-40" />;

  const slots = rs.params;
  const screens = measureScreens(rs, slots);
  const index = Math.min(screenIndex, screens.length - 1);
  const screen = screens[index]!;
  const missing = missingAnswers(screen, slots);
  const firstMissing = screens.findIndex((s) => missingAnswers(s, slots).length > 0);

  const setAnswer = (n: string, v: Param["value"]) => {
    const own = ((doc as { params?: OwnParams }).params ?? {}) as OwnParams;
    const params = answerParams(own, slots, n, v, patch, patch ? parent?.params[n]?.value : undefined);
    draft.setDoc({ ...doc, params } as OurRuleType);
  };
  const next = () => {
    setTried(true);
    if (missing.length) return;
    setTried(false);
    if (index < screens.length - 1) onScreen(index + 1);
    else onDone();
  };
  const suggested = () => {
    // "Use the suggested answers": keep every answer as it is and move on, unless a question has none.
    if (firstMissing >= 0) {
      onScreen(firstMissing);
      setTried(true);
      return;
    }
    onDone();
  };

  return (
    <div className="flex flex-col gap-5" data-testid="measure-step" data-screen={screen.id}>
      <div className="flex flex-col gap-1">
        <p className="label-caps text-muted-foreground">{t("progress", { n: index + 1, of: screens.length })}</p>
        <h2 className="text-title">{screenTitle(t, screen, slots)}</h2>
        <p className="text-muted-foreground">{screenIntro(t, screen, slots)}</p>
      </div>

      {screen.kind === "checklist" ? (
        <Checklist rs={rs} screen={screen} onToggle={(slot, on) => setAnswer(slot, on)} />
      ) : (
        <div className="flex flex-col gap-4">
          {screen.questions.map(({ slot, depth }) => {
            const p = slots[slot]!;
            const bad = tried && missing.includes(slot);
            return (
              <div key={slot} className={cn("flex flex-col gap-2 rounded-[var(--radius)] border border-border p-3", depth > 0 && "ml-6", bad && "border-error")} data-testid="setup-question" data-slot={slot}>
                <p className="font-medium">{p.question ?? p.label}</p>
                {p.help && <p className="text-muted-foreground">{p.help}</p>}
                {p.example && <p className="text-muted-foreground">{t("example", { text: p.example })}</p>}
                <div data-testid="setup-answer">
                  <Answer p={p} slots={slots} onChange={(v) => setAnswer(slot, v)} />
                </div>
                {bad && (
                  <p className="text-error" role="alert" data-testid="setup-missing">
                    {t("required")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button variant="outline" disabled={index === 0} onClick={() => onScreen(index - 1)} data-testid="setup-back">
          {t("back")}
        </Button>
        <Button onClick={next} data-testid="setup-next">
          {index < screens.length - 1 ? t("next") : t("toItems")}
        </Button>
        <Button variant="ghost" onClick={suggested} data-testid="setup-suggested">
          {t("suggested")}
        </Button>
        <span className="flex-1" />
        <Link href={`/${orgSlug}/library/rule_set/${preset.id}`} className="text-link hover:underline">
          {t("allSettings")}
        </Link>
      </div>
    </div>
  );
}

function screenTitle(t: ReturnType<typeof useTranslations>, screen: Screen, slots: RuleSet["params"]) {
  if (screen.kind === "checklist") return t("checklistTitle");
  if (screen.kind === "detail") return t("detailTitle", { what: slots[screen.slot!]?.label ?? screen.slot! });
  return screen.step!.title;
}

function screenIntro(t: ReturnType<typeof useTranslations>, screen: Screen, slots: RuleSet["params"]) {
  if (screen.kind === "checklist") return t("checklistIntro");
  if (screen.kind === "detail") return t("detailIntro", { what: slots[screen.slot!]?.label ?? screen.slot! });
  return screen.step!.intro ?? t("measureIntro");
}

/** 1a: one checkbox per switch, grouped by the rule set's sections. */
function Checklist({ rs, screen, onToggle }: { rs: RuleSet; screen: Screen; onToggle: (slot: string, on: boolean) => void }) {
  const groups = new Map<string, string[]>();
  for (const { slot } of screen.questions) {
    const title = sectionTitle(rs.sections, rs.params[slot]!.section ?? null) ?? "";
    groups.set(title, [...(groups.get(title) ?? []), slot]);
  }
  return (
    <div className="flex flex-col gap-4" data-testid="setup-checklist">
      {[...groups].map(([title, list]) => (
        <section key={title} className="flex flex-col gap-2">
          {title && <h3 className="label-caps text-muted-foreground">{title}</h3>}
          {list.map((slot) => {
            const p = rs.params[slot]!;
            return (
              <label key={slot} className="flex items-start gap-2" data-testid="setup-switch" data-slot={slot}>
                <input type="checkbox" className="mt-1" checked={p.value === true} onChange={(e) => onToggle(slot, e.target.checked)} />
                <span className="flex flex-col">
                  <span>{p.label}</span>
                  {p.question && <span className="text-muted-foreground">{p.question}</span>}
                </span>
              </label>
            );
          })}
        </section>
      ))}
    </div>
  );
}
