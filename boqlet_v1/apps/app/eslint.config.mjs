import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Every UI string goes through i18n (F15): `react/jsx-no-literals` forbids text in JSX, both as
 * children and as `{"string"}` expressions. Attributes stay free (class names, test ids, keys);
 * user-facing attributes (`aria-label`, `title`, `placeholder`, `alt`) are checked below.
 */
const NO_LITERALS = {
  noStrings: true,
  ignoreProps: true,
  allowedStrings: ["·", "—", "–", "→", "←", "×", "/", ":", "(", ")", "…", "%", "+", "-", "|", "*"],
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "next-env.d.ts", "messages/en-XA/**", "e2e/.output/**", "playwright-report/**", "test-results/**"]),
  {
    files: ["**/*.tsx"],
    rules: {
      "react/jsx-no-literals": ["error", NO_LITERALS],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name=/^(aria-label|aria-description|title|placeholder|alt)$/] > Literal[value=/[A-Za-z]/]",
          message: "User-facing attribute text must come from the i18n catalogue (F15).",
        },
      ],
    },
  },
  {
    // The pricing module is imported in exactly one place (architecture.md "Modules", P36).
    files: ["**/*.{ts,tsx}"],
    ignores: ["src/modules.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["@ifc-boq/pricing-ui", "@ifc-boq/pricing-ui/*"], message: "Only src/modules.ts may import the pricing module (P36)." }] }],
    },
  },
]);
