"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useNotificationPreferences, useSetNotificationPreferences } from "@/api/hooks/notifications";
import { useErrorMessage } from "@/components/errors/use-error-message";

/** F13 per-user preferences: email on or off per category (the bell is always on). Saved as toggled. */
export function EmailPreferences() {
  const t = useTranslations("notifications.preferences");
  const message = useErrorMessage();
  const prefs = useNotificationPreferences();
  const save = useSetNotificationPreferences();
  // A ticked box shows at once (a controlled checkbox would snap back until the server answers).
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const email = { ...(prefs.data?.email ?? {}), ...local };
  return (
    <section className="flex flex-col gap-3" data-testid="email-preferences">
      <h2 className="label-caps">{t("title")}</h2>
      <p className="text-muted-foreground">{t("intro")}</p>
      <ul className="flex flex-col gap-2">
        {Object.keys(email).map((category) => (
          <li key={category}>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 accent-[var(--link)]"
                checked={email[category] === true}
                onChange={(e) => {
                  const on = e.target.checked;
                  setLocal((l) => ({ ...l, [category]: on }));
                  save.mutate({ email: { [category]: on } }, { onError: () => setLocal((l) => ({ ...l, [category]: !on })) });
                }}
                data-testid={`email-${category}`}
              />
              <span className="flex flex-col">
                <span>{t.has(`categories.${category}.label`) ? t(`categories.${category}.label`) : category}</span>
                {t.has(`categories.${category}.hint`) && <span className="text-muted-foreground">{t(`categories.${category}.hint`)}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {save.isError && (
        <p role="alert" className="text-error">
          {message(save.error)}
        </p>
      )}
    </section>
  );
}
