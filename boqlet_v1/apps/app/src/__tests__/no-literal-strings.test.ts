import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

/** F15: the lint rule blocks literal UI strings in JSX (FE-002 acceptance). */
const appRoot = path.resolve(__dirname, "../..");
const eslint = new ESLint({ cwd: appRoot });
const probe = path.join(appRoot, "src", "components", "lint-probe.tsx");

async function rules(code: string) {
  const [result] = await eslint.lintText(code, { filePath: probe });
  return result!.messages.filter((m) => m.severity === 2).map((m) => m.ruleId);
}

describe("no literal UI strings", () => {
  it("rejects text children", async () => {
    expect(await rules(`export function A() { return <p>Hello</p>; }\n`)).toContain("react/jsx-no-literals");
  });
  it("rejects string expressions in JSX", async () => {
    expect(await rules(`export function A() { return <p>{"Hello"}</p>; }\n`)).toContain("react/jsx-no-literals");
  });
  it("rejects literal user-facing attributes", async () => {
    expect(await rules(`export function A() { return <button aria-label="Close" />; }\n`)).toContain("no-restricted-syntax");
  });
  it("accepts translated text and class names", async () => {
    const code = `import { useTranslations } from "next-intl";\nexport function A() {\n  const t = useTranslations("common");\n  return <p className="text-ui" aria-label={t("close")}>{t("close")}</p>;\n}\n`;
    expect(await rules(code)).toEqual([]);
  });
});
