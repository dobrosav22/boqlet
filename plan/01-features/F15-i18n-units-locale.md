# F15 i18n, units, locale, currency

## Requirements

1. **Every UI string goes through the i18n layer** (`next-intl`, ICU message format). No
   literal user-facing strings in components. Lint rule enforces it (see 06-frontend).
2. **English is the default; more languages are added as translations** (P07, P35): a new
   language is a new catalogue folder, no code change. Each user picks their language; the org
   sets the default for new members. Catalogue structure: `messages/en/{namespace}.json`, with
   namespaces per feature (`common`, `projects`, `models`, `boq`, `questions`, `library`,
   `settings`, `engine`; modules bring their own, e.g. `pricing`).
3. **Pseudo-locale** (`en-XA`: accented, 30% longer) for testing layout and missing keys
   (v1 acceptance criterion 11).
4. **Engine messages:** `Question`, `Warning` and `LogEntry` gain `code` + `params` (EN-004).
   The UI renders `engine.{code}` with params when the key exists, else falls back to
   `message`. Check codes (`CheckCode`) and question kinds already are codes.
5. **Domain vocabulary** (item names, rule descriptions, code titles, dictionary term
   labels) is **data**, not UI text. It is shown as authored in presets. Presets can carry
   multilingual labels later (dictionary `Term` already has labels per language: docs/07).
6. **Locale formatting:** numbers (`Intl.NumberFormat`), dates (`Intl.DateTimeFormat`), relative
   times, with the user's locale for UI chrome and the **project locale** for BoQ values and
   exports.
7. **Units:** the engine emits `Unit` values (`m`, `m2`, `m3`, `kg`, `t`, `nr`, `item`, ...;
   imperial when the project is imperial). The UI shows them with a display map (`m2` → `m²`)
   from the i18n catalogue. Unit conversion is done by the engine only (BR-01).
8. **Currency:** per org (default), per project, and in the pricing module per estimate and
   offer request. Formatting via
   `Intl.NumberFormat(locale, {style: "currency", currency})`. Rates allow up to 4 decimals.
   Amounts are rounded to the currency's minor units (BR-47).
9. **Time zones:** stored UTC. Deadlines (pricing module) carry an explicit IANA timezone and are shown
   in both that zone and the viewer's local zone.
10. **Right-to-left** is not needed in v1. Use logical CSS properties anyway
    (`margin-inline-start`) so it stays cheap later.

11. **Org-customisable formats** (P35): currency, unit system, decimal and thousands
    separators and date format are org settings (defaults from the org's locale) and can be set
    per project. Nothing assumes a country: no market is built into rules, the wizard or the UI.

## Acceptance criteria

- [ ] The pseudo-locale build shows no untranslated strings on the screens listed in v1 criterion 11.
- [ ] Changing the user's locale changes UI number/date formats. BoQ values keep the project locale.
- [ ] Every engine question in the Duplex run renders from a message key (no fallback used) once EN-004 lands.
