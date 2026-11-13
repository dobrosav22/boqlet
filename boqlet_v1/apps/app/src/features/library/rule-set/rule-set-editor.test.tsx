// @vitest-environment jsdom
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fireEvent as domFireEvent } from "@testing-library/dom";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ItemRule, OurRuleType, Param, RuleSet, RuleSetPatch } from "@ifc-boq/types";
import type { Preset } from "@/api/hooks/library";
import library from "../../../../messages/en/library.json";
import ruleSetEditor from "../../../../messages/en/ruleSetEditor.json";
import asModelled from "../../../../../../presets/rules/as-modelled.json";
import standardStyle from "../../../../../../presets/rules/standard-style-example.json";
import { useLexicon, useStoryText } from "./item-story";
import { RuleSetEditor } from "./rule-set-editor";

/*
 * The app runs React 19; next-intl, Base UI and lucide sit in the monorepo root next to the PoC's
 * React 18 and would render with that copy here (Next bundles them with the app's). So this file
 * mounts with the app's react-dom, translates with use-intl's core translator (no React inside, the
 * real message formatting), and swaps the two UI packages for plain elements.
 */
vi.mock("next-intl", async () => {
  const React = await import("react");
  const { createTranslator } = await import("use-intl/core");
  type Config = { locale: string; messages: Record<string, unknown>; onError?: (e: Error) => void };
  const Ctx = React.createContext<Config | null>(null);
  return {
    NextIntlClientProvider: ({ children, ...config }: Config & { children: React.ReactNode }) => React.createElement(Ctx.Provider, { value: config }, children),
    useTranslations: (namespace?: string) => {
      const config = React.useContext(Ctx)!;
      return React.useMemo(() => createTranslator({ locale: config.locale, messages: config.messages as never, namespace: namespace as never, onError: config.onError as never }), [config, namespace]);
    },
  };
});
vi.mock("@/components/ui/button", async () => {
  const React = await import("react");
  // variant and size are styling only
  const Button = (props: Record<string, unknown>) => React.createElement("button", Object.fromEntries(Object.entries(props).filter(([k]) => k !== "variant" && k !== "size")));
  return { Button };
});
vi.mock("lucide-react", async () => {
  const React = await import("react");
  return { ArrowUp: () => React.createElement("span") };
});

const messages = { library, ruleSetEditor };
const base = asModelled as unknown as RuleSet;
const patch = standardStyle as unknown as RuleSetPatch;

/** Missing or broken messages fail the test instead of rendering the key. */
function Intl({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      onError={(e) => {
        throw e;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}

function Harness({ initial, parent, question, onChange }: { initial: OurRuleType; parent: RuleSet | null; question?: string | null; onChange?: (d: OurRuleType) => void }) {
  const [doc, setDoc] = useState(initial);
  return (
    <RuleSetEditor
      preset={{} as Preset}
      doc={doc}
      parent={parent}
      question={question}
      onChange={(d) => {
        setDoc(d);
        onChange?.(d);
      }}
    />
  );
}

/*
 * React 19 is the app's; @testing-library/react resolves the monorepo root's React 18 (the PoC's),
 * so this mounts with the app's own react-dom and uses the framework-free DOM helpers.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let host: HTMLElement | null = null;
function mount(node: ReactNode) {
  host = document.body.appendChild(document.createElement("div"));
  root = createRoot(host);
  act(() => root!.render(<Intl>{node}</Intl>));
}
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const all = (id: string, within: ParentNode = document) => [...within.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)];
const one = (id: string, within: ParentNode = document) => {
  const el = within.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (!el) throw new Error(`no [data-testid="${id}"]`);
  return el;
};
const fireEvent = {
  click: (el: Element) => act(() => void domFireEvent.click(el)),
  change: (el: Element, init: object) => act(() => void domFireEvent.change(el, init)),
};
const screen = { getByTestId: (id: string) => one(id), getAllByTestId: (id: string) => all(id) };
const within = (el: HTMLElement) => ({
  getByTestId: (id: string) => one(id, el),
  getAllByTestId: (id: string) => all(id, el),
  getByRole: (role: string) => {
    const found = el.querySelector<HTMLElement>(role === "spinbutton" ? 'input[type="number"]' : `[role="${role}"]`);
    if (!found) throw new Error(`no ${role}`);
    return found;
  },
});
function renderHook<T>(hook: () => T) {
  const result = { current: undefined as T };
  function Probe() {
    result.current = hook();
    return null;
  }
  mount(<Probe />);
  return { result };
}

const renderEditor = (props: Parameters<typeof Harness>[0]) => mount(<Harness {...props} />);

describe("RuleSetEditor", () => {
  it("opens the Settings question of ?question=, marked, on a patch", () => {
    const onChange = vi.fn();
    renderEditor({ initial: patch, parent: base, question: "wall_opening_threshold", onChange });
    expect(screen.getByTestId("rule-tab-settings").getAttribute("aria-selected")).toBe("true");
    const card = screen.getAllByTestId("question").find((c) => c.dataset.slot === "wall_opening_threshold")!;
    expect(card.dataset.focused).toBe("true");
    expect(screen.getAllByTestId("question").filter((c) => c.dataset.focused)).toHaveLength(1);
    // 0.5 here against the parent's own default: an answer of this set, which can go back to the default
    expect(card.dataset.mine).toBe("true");
    fireEvent.click(within(card).getByTestId("use-default"));
    const saved = onChange.mock.calls.at(-1)![0] as RuleSetPatch;
    expect(saved.params?.wall_opening_threshold).toBeUndefined();
    expect(saved.params?.wall_opening_mode).toEqual(patch.params?.wall_opening_mode);
  });

  it("shows the deep-linked question even when it is a follow-up that does not apply", () => {
    const doc: RuleSet = { ...base, params: { ...base.params, wall_opening_mode: { ...base.params.wall_opening_mode, value: "all" } as Param } };
    renderEditor({ initial: doc, parent: null, question: "wall_opening_threshold" });
    const card = screen.getAllByTestId("question").find((c) => c.dataset.slot === "wall_opening_threshold");
    expect(card?.dataset.focused).toBe("true");
  });

  it("stores only differing answers on a patch", () => {
    const onChange = vi.fn();
    const mode = { wall_opening_mode: { value: "over_threshold" } };
    renderEditor({ initial: { ...patch, params: mode }, parent: base, onChange });
    const input = () => {
      const card = screen.getAllByTestId("question").find((c) => c.dataset.slot === "wall_opening_threshold");
      if (!card) throw new Error("the follow-up question is not shown");
      return within(within(card).getByTestId("answer")).getByRole("spinbutton");
    };
    fireEvent.change(input(), { target: { value: "0.25" } });
    expect((onChange.mock.calls.at(-1)![0] as RuleSetPatch).params).toEqual({ ...mode, wall_opening_threshold: { value: 0.25 } });
    // back to the inherited value: nothing stored
    fireEvent.change(input(), { target: { value: String(base.params.wall_opening_threshold!.value) } });
    expect((onChange.mock.calls.at(-1)![0] as RuleSetPatch).params).toEqual(mode);
  });

  it("renders every item of a full rule set, and every Advanced tab", () => {
    renderEditor({ initial: base, parent: null });
    fireEvent.click(screen.getByTestId("rule-tab-items"));
    const rows = screen.getAllByTestId("row");
    expect(rows.length).toBe(base.items.length + (base.derived?.length ?? 0) + (base.manual?.length ?? 0));
    for (const row of rows) {
      fireEvent.click(row);
      expect(screen.getByTestId("item-story")).toBeTruthy();
    }
    fireEvent.click(screen.getByTestId("rule-tab-advanced"));
    expect(screen.getByTestId("rule-set-about")).toBeTruthy();
    fireEvent.click(screen.getByTestId("rule-tab-setup"));
    for (const row of screen.getAllByTestId("row").slice(0, 15)) {
      fireEvent.click(row);
      expect(screen.getByTestId("question-form")).toBeTruthy();
    }
    fireEvent.click(screen.getByTestId("rule-tab-json"));
    expect(screen.getByTestId("json-tab")).toBeTruthy();
  });

  it("marks a patch's items and can change an inherited one here", () => {
    const onChange = vi.fn();
    renderEditor({ initial: { ...patch, items: [], derived: [], remove: undefined }, parent: base, onChange });
    fireEvent.click(screen.getByTestId("rule-tab-items"));
    const first = screen.getAllByTestId("row")[0]!;
    fireEvent.click(first);
    expect(screen.getByTestId("item-actions").dataset.status).toBe("inherited");
    fireEvent.click(screen.getByTestId("change-here"));
    expect((onChange.mock.calls.at(-1)![0] as RuleSetPatch).items).toEqual([base.items[0]]);
    expect(screen.getByTestId("item-actions").dataset.status).toBe("changed");
  });

  it("opens an item from Used by", () => {
    renderEditor({ initial: patch, parent: base, question: "wall_opening_threshold" });
    const card = screen.getAllByTestId("question").find((c) => c.dataset.slot === "wall_opening_threshold")!;
    fireEvent.click(within(card).getAllByTestId("used-by-link")[0]!);
    expect(screen.getByTestId("rule-tab-items").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("item-form")).toBeTruthy();
  });
});

describe("item sentences", () => {
  const slots = base.params;
  const story = () => {
    const { result } = renderHook(() => ({ s: useStoryText(), lex: useLexicon(slots) }));
    return result.current;
  };

  it("says how an item is measured", () => {
    const { s, lex } = story();
    expect(s.qtyShort({ kind: "area", surface: "both", start: "gross" }, slots, lex)).toBe("area (both faces, gross, openings left in)");
    expect(s.qtyShort({ kind: "count", unit: "nr" }, slots, lex)).toBe("count in nr");
    expect(s.qtyShort({ kind: "when", if: "thickness >= 0.25", then: { kind: "volume" }, else: { kind: "area" } }, slots, lex)).toBe("if Thickness >= 0.25: volume, otherwise area");
    expect(s.qtyShort({ kind: "choose", pick: "x", options: {} }, slots, lex)).toBe("as a fixed choice says (now “x”, which has no way of measuring)");
  });

  it("puts deductions and conditions in words", () => {
    const { s, lex } = story();
    expect(s.deductionWords({ what: "openings", mode: "over_threshold", threshold: 0.5 }, slots, lex)).toBe("minus openings larger than 0.5 m2");
    expect(s.deductionWords({ what: "doors", mode: "none" }, slots, lex)).toBeNull();
    expect(s.deductionWords({ what: "windows", mode: "all", addReveals: true }, slots, lex)).toBe("minus all windows, reveals added back");
    expect(s.condWords({ field: "is_external", op: "eq", value: true }, slots, lex)).toBe("external is yes");
    expect(s.condWords({ any: [{ ifcClass: "IfcWall" }, { ifcClass: ["IfcSlab", "IfcBeam"] }] }, slots, lex)).toBe("either they are walls or they are slabs and beams");
    expect(s.whatShort({ all: [{ ifcClass: ["IfcWall", "IfcColumn"] }, { field: "material", op: "under", value: "concrete" }] })).toBe("walls and columns");
  });

  it("reads line splits and line texts", () => {
    const { s, lex } = story();
    expect(s.lineKeyWords("type_name", slots, lex)).toBe("type name");
    expect(s.templatePieces("Wall, {type_name}, {thickness*1000} mm", slots, lex)).toEqual([
      { text: "Wall, " },
      { value: true, text: "Type name" },
      { text: ", " },
      { value: true, text: "Thickness in mm" },
      { text: " mm" },
    ]);
  });

  it("lists what More options changes", () => {
    const { s } = story();
    const item: ItemRule = { id: "x", label: "X", match: { ifcClass: "IfcWall" }, quantity: { kind: "area" }, description: "", scope: "out", factor: 1.05, onMissing: "skip" };
    expect(s.itemExtras(item, slots)).toEqual(["only elements left out of this BoQ", "× 1.05", "missing values: skip the element"]);
  });

  it("writes a whole item sentence", () => {
    renderEditor({ initial: { ...base, items: [{ id: "w", label: "W", match: { ifcClass: "IfcWall" }, quantity: { kind: "area", surface: "both" }, lineKey: ["type_name"], description: "Wall, {type_name}" }], derived: [], manual: [] }, parent: null });
    fireEvent.click(screen.getByTestId("rule-tab-items"));
    expect(screen.getByTestId("item-story").textContent).toContain("Measure the area (both faces) of walls, one line per type name, written as “Wall, Type name”.");
  });
});
