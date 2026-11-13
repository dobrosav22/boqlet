import { describe, expect, it } from "vitest";
import { createTranslator, IntlErrorCode } from "next-intl";
import dictionaryEditor from "../../../../messages/en/dictionaryEditor.json";

/*
 * The story component itself is not rendered here: next-intl resolves to the workspace root's React
 * while the app's tests use the app's own React, so a rendered provider fails. Its messages are
 * checked through the translator instead (the same ICU text and tags DictStory passes to t.rich).
 */
type Markup = (key: string, values: Record<string, unknown>) => string;

function translator(onInvalid?: (message: string) => void) {
  return createTranslator({
    locale: "en",
    messages: { dictionaryEditor },
    namespace: "dictionaryEditor",
    onError: (e) => {
      if (e.code === IntlErrorCode.INVALID_MESSAGE) onInvalid?.(e.message);
    },
  }) as unknown as { markup: Markup };
}

const tag = (name: string) => (chunks: string) => `[${name}:${chunks}]`;

describe("the dictionary story", () => {
  const t = translator();
  it("names the dictionary, its layer and an example", () => {
    const text = t.markup("story.intro", { b: tag("b"), about: tag("about"), name: "Studio names", layer: "company", hasExample: "yes", raw: "Beton", term: "In-situ concrete" });
    expect(text).toMatch(/^\[b:Studio names\] is a \[about:company\] dictionary: it says what the names in IFC models mean, e\.g\. “Beton” means In-situ concrete\. Rules/);
    expect(t.markup("story.intro", { b: tag("b"), about: tag("about"), name: "Empty", layer: "project", hasExample: "no", raw: "", term: "" })).toMatch(/models mean\. Rules/);
  });

  it("counts names, meanings and value readers, with links into the tabs", () => {
    const tags = { entries: tag("entries"), terms: tag("terms"), extractors: tag("extractors"), names: tag("names") };
    expect(t.markup("story.knows", { ...tags, nameCount: 2, termCount: 1, partial: "yes", exact: 1, loose: 1, readers: 1 })).toBe(
      "It knows [entries:2 names] (1 exactly, 1 by their start, a part or a pattern), defines [terms:1 meaning of its own] and reads [extractors:values out of names in 1 way] (thickness, strength class…). [names:Names in the model] shows what each name in a model version means and lets you answer the ones not understood.",
    );
    expect(t.markup("story.knows", { ...tags, nameCount: 1, termCount: 0, partial: "no", exact: 1, loose: 0, readers: 0 })).toMatch(/^It knows \[entries:1 name\], defines \[terms:0 meanings of its own\]\. \[names:/);
  });
});

describe("dictionaryEditor messages", () => {
  it("are all valid ICU messages", () => {
    const invalid: string[] = [];
    const t = translator((m) => invalid.push(m));
    const walk = (o: object, path: string[]) => {
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === "string") t.markup([...path, k].join("."), {});
        else walk(v as object, [...path, k]);
      }
    };
    walk(dictionaryEditor, []);
    expect(invalid).toEqual([]);
  });
});
