/** What admins type into the org detail's dialogs (F19 §4). */

/** A number, `true`/`false`, or empty (remove the override). Anything else is not a value. */
export function parseOverrideValue(raw: string): number | boolean | null | undefined {
  const v = raw.trim();
  if (v === "") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  const n = Number(v);
  return Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(v) ? n : undefined;
}

/** Tags typed as "a, b, c": trimmed, no empties, no duplicates. */
export function parseTags(raw: string): string[] {
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}
