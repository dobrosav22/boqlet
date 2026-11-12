/**
 * Dictionaries in plain words: what a dictionary does, which one wins when several know a name,
 * and one sentence per entry, meaning (term) and value reader (extractor).
 *
 * Words only: patterns and conditions are shown, never run here; the engine resolves names
 * (Names in a model).
 */
import type { ReactNode } from "react";
import type { DictField, Dictionary, DictionaryEntry, Extractor, ExtractTarget, Term, TermCategory, TextMatch } from "@ifc-boq/types";
import { lexicon } from "./readable";
import { prose } from "./itemStory";

export type DictPart = "names" | "entries" | "terms" | "extractors" | "about";

export const FIELD_WORDS: Record<string, string> = {
  material: "material",
  layer_material: "layer material",
  type_name: "type name",
  name: "name",
  object_type: "object type",
  ifc_class: "IFC class",
  predefined_type: "predefined type",
  system: "system",
  space_name: "room name",
};
export const CATEGORY_WORDS: Record<TermCategory, string> = {
  material: "material",
  product: "product (brick, board, window unit…)",
  element_type: "kind of element (party wall, partition…)",
  space: "room use (kitchen, bathroom…)",
  system: "service system (cold water, supply air…)",
  other: "other",
};
export const TARGET_WORDS: Partial<Record<ExtractTarget, string>> = {
  type_name: "type name",
  family: "family",
  thickness: "thickness",
  width: "width",
  height: "height",
  length: "length",
  diameter: "diameter",
  strength_class: "strength class",
  profile: "steel profile",
  nominal_size: "nominal size",
  term: "a name to look up (its meaning)",
};
export const LAYER_WORDS = { global: "global", company: "company", project: "project" } as const;

const list = <T,>(v: T | T[]) => (Array.isArray(v) ? v : [v]);
const orList = (l: string[]) => (l.length <= 1 ? l.join("") : `${l.slice(0, -1).join(", ")} or ${l[l.length - 1]}`);
const quoted = (l: string[]) => orList(l.map((s) => `“${s}”`));

export const fieldsWords = (f: DictField | DictField[]) => orList(list(f).map((x) => (x.startsWith("props.") ? `property ${x.slice(6)}` : FIELD_WORDS[x] ?? x)));

export function textMatchWords(m: TextMatch): string {
  if ("exact" in m) return `is exactly ${quoted(list(m.exact))}`;
  if ("startsWith" in m) return `starts with ${quoted(list(m.startsWith))}`;
  if ("contains" in m) return `contains ${quoted(list(m.contains))}`;
  return `matches the pattern ${m.regex}`;
}

export const termWords = (id: string, label: (id: string) => string | undefined) => {
  const l = label(id);
  return l ? `${l} (${id})` : `${id || "(no meaning chosen)"}${id ? ", a meaning no dictionary defines" : ""}`;
};

export function entrySentence(e: DictionaryEntry, label: (id: string) => string | undefined): string {
  const when = e.when ? `, only when ${prose(e.when, lexicon({}))}` : "";
  return `A ${fieldsWords(e.field)} that ${textMatchWords(e.match)} means ${termWords(e.term, label)}${when}.`;
}

export function termSentence(t: Term, label: (id: string) => string | undefined, names: number): string {
  const under = t.broader ? `, a kind of ${termWords(t.broader, label)}` : "";
  return `${t.label} is a ${CATEGORY_WORDS[t.category].replace(/ \(.*\)$/, "")}${under}. ${names} name${names === 1 ? "" : "s"} in this dictionary mean${names === 1 ? "s" : ""} it.`;
}

export function extractorSentence(x: Extractor): string {
  const outs = Object.entries(x.outputs).map(([g, o]) => `${TARGET_WORDS[o.target] ?? o.target}${o.unit ? ` (written in ${o.unit})` : ""} from the part “${g}”`);
  const when = x.when ? `, only when ${prose(x.when, lexicon({}))}` : "";
  return `From the ${fieldsWords(x.field)}, text matching ${x.regex} gives the ${orList(outs).replace(/ or /g, " and ")}${when}. ${x.override ? "It overwrites values the model already has." : "A value the model already has is kept."}`;
}

/* ---------------------------------------------------------------- the dictionary in a few sentences */

export function DictStory({ doc, label, onJump }: { doc: Dictionary; label: (id: string) => string | undefined; onJump: (p: DictPart) => void }) {
  const Jump = ({ to, children }: { to: DictPart; children: ReactNode }) => (
    <span role="button" tabIndex={0} className="story-seg" onClick={() => onJump(to)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onJump(to))}>
      {children}
    </span>
  );
  const example = doc.entries.find((e) => "exact" in e.match) ?? doc.entries[0];
  const exampleRaw = example ? list("exact" in example.match ? example.match.exact : "startsWith" in example.match ? example.match.startsWith : "contains" in example.match ? example.match.contains : example.match.regex)[0] : undefined;
  const exact = doc.entries.filter((e) => "exact" in e.match).length;
  const terms = doc.terms?.length ?? 0;
  const readers = doc.extractors?.length ?? 0;
  return (
    <div className="story">
      <p>
        <b>{doc.name || doc.id}</b> is a <Jump to="about">{LAYER_WORDS[doc.layer]}</Jump> dictionary: it says what the names in IFC models mean
        {example && exampleRaw ? (
          <>
            , e.g. “{exampleRaw}” means {label(example.term) ?? example.term}
          </>
        ) : null}
        . Rules and classifications work with these meanings instead of the raw names, so the same rules work on models from any office, in any language. It changes quantities only
        through the rules that use the meanings.
      </p>
      <p className="story-meta">
        It knows <Jump to="entries">{doc.entries.length} names</Jump>
        {doc.entries.length > exact ? ` (${exact} exactly, ${doc.entries.length - exact} by their start, a part or a pattern)` : ""}, defines{" "}
        <Jump to="terms">{terms} meaning{terms === 1 ? "" : "s"} of its own</Jump>
        {readers > 0 && (
          <>
            {" "}
            and reads <Jump to="extractors">values out of names in {readers} way{readers === 1 ? "" : "s"}</Jump> (thickness, strength class…)
          </>
        )}
        . <Jump to="names">Names in a model</Jump> shows what each name in a loaded model means and lets you answer the ones not understood.
      </p>
      <p className="story-meta">
        When several dictionaries know a name, the most specific wins: your answer in the project (BoQ › Questions), then project, company and global dictionaries. Within one dictionary an
        exact name wins over “starts with”, then a pattern, then “contains”.
      </p>
    </div>
  );
}
