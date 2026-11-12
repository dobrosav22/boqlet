#!/usr/bin/env node
// Generate the pseudo-locale `en-XA` from `messages/en` (F15, v1 criterion 11): every letter
// accented, the text wrapped in [ ] and made about 30 % longer, so clipped, overlapping and
// untranslated strings show up. ICU arguments ({name}, plural keywords) and rich-text tags stay
// as they are. Output: messages/en-XA/*.json (generated, git-ignored); runs before dev and build.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ACCENTS = {
  a: "á", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "í", j: "ĵ", k: "ķ", l: "ļ", m: "ɱ",
  n: "ñ", o: "ó", p: "þ", q: "ǫ", r: "ŕ", s: "š", t: "ţ", u: "ú", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Á", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Í", J: "Ĵ", K: "Ķ", L: "Ļ", M: "Ṁ",
  N: "Ñ", O: "Ó", P: "Þ", Q: "Ǫ", R: "Ŕ", S: "Š", T: "Ţ", U: "Ú", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};

/** Accent the literal text of one ICU message; text sits at even brace depth, arguments at odd. */
export function pseudo(message) {
  let out = "";
  let depth = 0;
  let inTag = false;
  let letters = 0;
  for (const ch of message) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === "<" && depth % 2 === 0) inTag = true;
    else if (ch === ">" && inTag) {
      inTag = false;
      out += ch;
      continue;
    }
    if (depth % 2 === 0 && !inTag && ch !== "}" && ACCENTS[ch]) {
      out += ACCENTS[ch];
      letters++;
    } else out += ch;
  }
  const pad = "~".repeat(Math.max(1, Math.round(letters * 0.3)));
  return `[${out} ${pad}]`;
}

function walk(value) {
  if (typeof value === "string") return pseudo(value);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]));
  return value;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "messages");
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await mkdir(path.join(root, "en-XA"), { recursive: true });
  for (const file of (await readdir(path.join(root, "en"))).filter((f) => f.endsWith(".json"))) {
    const en = JSON.parse(await readFile(path.join(root, "en", file), "utf8"));
    await writeFile(path.join(root, "en-XA", file), JSON.stringify(walk(en), null, 2) + "\n", "utf8");
  }
  console.log("[i18n] wrote messages/en-XA");
}
