"use client";

import { createTranslator } from "next-intl";
import common from "../messages/en/common.json";

// Replaces the root layout when that fails, so there are no providers: English, read directly.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  const t = createTranslator({ locale: "en", messages: { common }, namespace: "common" });
  return (
    <html lang="en">
      <body style={{ fontFamily: "ui-monospace, monospace", background: "#F2EDE3", color: "#151515", padding: 32 }}>
        <h1>{t("error.title")}</h1>
        <p>{t("error.body")}</p>
        <button type="button" onClick={reset}>
          {t("retry")}
        </button>
      </body>
    </html>
  );
}
