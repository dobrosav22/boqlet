import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spot-check of design-guidelines.md "What may be text, and what only fill" against the tokens
 * actually shipped in app/globals.css: values and WCAG 2.2 AA contrast, light and dark.
 */
const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("\n}", start));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[m[1]!] = m[2]!.trim();
  return vars;
}
const root = block(":root");
const dark = { ...root, ...block(".dark") };

function resolve(vars: Record<string, string>, name: string): string {
  let value = vars[name];
  for (let i = 0; value?.startsWith("var(") && i < 5; i++) value = vars[value.slice(6, -1)];
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`--${name} is not a hex colour: ${value}`);
  return value.toLowerCase();
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}

describe("light theme tokens (paper)", () => {
  const bg = resolve(root, "background");
  it("uses the guidelines' palette", () => {
    expect(bg).toBe("#f2ede3");
    expect(resolve(root, "foreground")).toBe("#151515");
    expect(resolve(root, "link")).toBe("#1e4fb8");
    expect(resolve(root, "status-attention")).toBe("#e8590c");
    expect(resolve(root, "status-manual")).toBe("#f2b705");
    expect(resolve(root, "destructive")).toBe("#c62423");
    expect(root.radius).toBe("2px");
  });
  it.each([
    ["foreground", 15],
    ["muted-foreground", 4.5],
    ["link", 4.5],
    ["destructive", 4.5],
    ["status-error", 4.5],
  ])("%s is readable as text on paper (≥ %s)", (token, min) => {
    expect(contrast(resolve(root, token), bg)).toBeGreaterThanOrEqual(min);
  });
  it("control borders and focus reach 3:1", () => {
    expect(contrast(resolve(root, "input"), bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(resolve(root, "ring"), bg)).toBeGreaterThanOrEqual(3);
  });
  it("orange and yellow are fills with ink text", () => {
    expect(contrast(resolve(root, "status-attention"), bg)).toBeLessThan(4.5);
    expect(contrast(resolve(root, "on-fill"), resolve(root, "status-attention"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(resolve(root, "on-fill"), resolve(root, "status-manual"))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("dark theme tokens (ink)", () => {
  const bg = resolve(dark, "background");
  it("swaps paper and ink and lightens blue and red", () => {
    expect(bg).toBe("#151515");
    expect(resolve(dark, "foreground")).toBe("#f2ede3");
    expect(resolve(dark, "link")).toBe("#7d9be6");
    expect(resolve(dark, "destructive")).toBe("#e06a69");
  });
  it.each([
    ["foreground", 15],
    ["muted-foreground", 4.5],
    ["link", 4.5],
    ["destructive", 4.5],
    ["status-attention", 4.5],
    ["status-manual", 4.5],
  ])("%s is readable as text on ink (≥ %s)", (token, min) => {
    expect(contrast(resolve(dark, token), bg)).toBeGreaterThanOrEqual(min);
  });
  it("control borders and focus reach 3:1", () => {
    expect(contrast(resolve(dark, "input"), bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(resolve(dark, "ring"), bg)).toBeGreaterThanOrEqual(3);
  });
});
