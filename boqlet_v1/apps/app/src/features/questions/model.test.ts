import { describe, expect, it } from "vitest";
import type { Question, Term } from "@/api/hooks/decisions";
import { bulkKey, counts, describeAnswer, filterQuestions, initialValue, searchTerms, selectable, sortQuestions, termPath } from "./model";

const decision = (answer: string | number | boolean | null): NonNullable<Question["decision"]> => ({
  id: "d",
  projectId: "p",
  questionId: "q",
  kind: "unknown_name",
  answer,
  decidedAt: "2026-11-13T10:00:00Z",
});

const q = (id: string, extra: Partial<Question> = {}): Question => ({
  id,
  kind: "unknown_name",
  blocking: false,
  message: id,
  answer: { kind: "term", category: "material" },
  answeredAfterRun: false,
  ...extra,
});

const terms: Term[] = [
  { id: "concrete", label: "Concrete", category: "material" },
  { id: "concrete.in_situ", label: "In-situ concrete", category: "material", parent: "concrete" },
  { id: "masonry", label: "Masonry", category: "material" },
  { id: "room", label: "Room", category: "space" },
];
const byId = new Map(terms.map((t) => [t.id, t]));

describe("order (F05 §1)", () => {
  it("puts unanswered first, then blocking, then kind, then the most occurrences", () => {
    const list = [
      q("answered-blocking", { blocking: true, decision: decision("concrete") }),
      q("info-few", { occurrences: 2 }),
      q("info-many", { occurrences: 20 }),
      q("blocking", { blocking: true, occurrences: 1 }),
      q("contradiction", { kind: "contradiction", answer: { kind: "choice", options: [{ value: "a", label: "A" }] } }),
    ];
    expect(sortQuestions(list).map((x) => x.id)).toEqual(["blocking", "contradiction", "info-many", "info-few", "answered-blocking"]);
  });
});

describe("filters and counts", () => {
  const list = [q("a", { blocking: true }), q("b", { decision: decision("concrete"), answeredAfterRun: true }), q("c", { kind: "unmatched", answer: { kind: "rule" } }), q("d", { answeredAfterRun: true })];
  it("filters by kind and answered state", () => {
    expect(filterQuestions(list, { state: "unanswered" }).map((x) => x.id)).toEqual(["a", "c", "d"]);
    expect(filterQuestions(list, { state: "answered" }).map((x) => x.id)).toEqual(["b"]);
    expect(filterQuestions(list, { state: "all", kind: "unmatched" }).map((x) => x.id)).toEqual(["c"]);
  });
  it("counts open, blocking and answers not applied yet (a cleared answer counts too)", () => {
    expect(counts(list)).toEqual({ unanswered: 3, blocking: 1, notApplied: 2 });
  });
});

describe("bulk answers (F05 edge cases)", () => {
  it("keeps one kind and one answer control in a selection", () => {
    const material = q("m1");
    const space = q("s1", { answer: { kind: "term", category: "space" } });
    const choiceA = q("c1", { kind: "contradiction", answer: { kind: "choice", options: [{ value: "reported", label: "R" }, { value: "geometry", label: "G" }] } });
    const choiceB = q("c2", { kind: "overlap", answer: { kind: "choice", options: [{ value: "reported", label: "R" }, { value: "geometry", label: "G" }] } });
    expect(selectable([], space)).toBe(true);
    expect(selectable([material], q("m2"))).toBe(true);
    expect(selectable([material], space)).toBe(false);
    expect(selectable([choiceA], choiceB)).toBe(false);
    expect(bulkKey(material)).toBe("unknown_name/term:material");
  });
});

describe("initial value (F05 §4)", () => {
  it("prefers the decision, then a suggestion that fits the control", () => {
    const choice = { kind: "choice" as const, options: [{ value: "reported", label: "R", recommended: true }, { value: "geometry", label: "G" }] };
    expect(initialValue(q("x", { answer: choice, suggestion: "reported" }))).toEqual({ value: "reported", suggested: true });
    expect(initialValue(q("x", { answer: choice, suggestion: "both" }))).toEqual({ value: undefined, suggested: false });
    expect(initialValue(q("x", { answer: choice, suggestion: "reported", decision: decision(null) }))).toEqual({ value: null, suggested: false });
  });
});

describe("answers as text", () => {
  it("names terms by their path, options by their label, and marks the special answers", () => {
    expect(termPath("concrete.in_situ", byId)).toEqual(["Concrete", "In-situ concrete"]);
    expect(describeAnswer("concrete.in_situ", { kind: "term" }, { terms: byId })).toEqual({ text: "Concrete › In-situ concrete" });
    expect(describeAnswer("gone.term", { kind: "term" }, { terms: byId })).toEqual({ text: "gone.term" });
    expect(describeAnswer("geometry", { kind: "choice", options: [{ value: "geometry", label: "Use the geometry" }] })).toEqual({ text: "Use the geometry" });
    expect(describeAnswer(null, { kind: "term" })).toEqual({ special: "dismissed" });
    expect(describeAnswer("flag", { kind: "number", unit: "m" })).toEqual({ special: "flag" });
    expect(describeAnswer("exclude", { kind: "rule" })).toEqual({ special: "exclude" });
    expect(describeAnswer("C.10", { kind: "code", system: "acme" }, { codes: new Map([["C.10", "Concrete"]]) })).toEqual({ text: "C.10 Concrete" });
    expect(describeAnswer(2.5, { kind: "number", unit: "m" })).toEqual({ text: "2.5" });
  });
});

describe("term search", () => {
  it("matches labels, ids and broader terms, within a category", () => {
    expect(searchTerms(terms, "situ").map((t) => t.id)).toEqual(["concrete.in_situ"]);
    expect(searchTerms(terms, "concrete").map((t) => t.id)).toEqual(["concrete", "concrete.in_situ"]);
    expect(searchTerms(terms, "", "space").map((t) => t.id)).toEqual(["room"]);
    expect(searchTerms(terms, "concrete in-situ").map((t) => t.id)).toEqual(["concrete.in_situ"]);
  });
});
