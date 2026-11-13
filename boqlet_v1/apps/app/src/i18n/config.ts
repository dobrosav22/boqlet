/** UI locales. `en-XA` is the generated pseudo-locale (accented, ~30 % longer) for layout tests (F15). */
export const LOCALES = ["en", "en-XA"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** The cookie that carries the user's UI language (set from `GET /me` user.locale, FE-005). */
export const LOCALE_COOKIE = "boqlet-locale";

/**
 * Message namespaces: one JSON file per namespace in `messages/<locale>/` (F15). A new namespace is
 * added here and as `messages/en/<name>.json`; modules bring their own (registered later, P36).
 */
export const NAMESPACES = ["common", "shell", "errors", "units", "auth", "orgs", "settings", "account", "projects", "models", "boqs", "questions", "library", "ruleSetEditor", "classificationEditor", "dictionaryEditor", "setup", "notifications", "viewer"] as const;

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
