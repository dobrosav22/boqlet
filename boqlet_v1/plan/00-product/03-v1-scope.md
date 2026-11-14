# 03 v1 scope

## In v1

| Area | In scope | Feature |
|---|---|---|
| Accounts | Public sign-up into the default tier, create organisation, invite members, org roles, multi-org membership, one active session per account (P22). Account kinds: org users, vendor users (pricing module); no logged-in guests (P28) | F01 |
| Projects | Create, settings (currency, units, locale, default presets), project members and roles, archive | F02 |
| Models | Several discipline models per project, versions, upload with progress, parse job, input-check report, discipline and scope rules per model | F03 |
| BoQ | Several BoQs per project; inputs (model versions + presets); runs as background jobs; needs-input state | F04 |
| Questions | All engine question kinds; answer, dismiss, bulk answer; project decisions carried across versions and BoQs; promote name answers to the company dictionary | F05 |
| Sheet | Virtualised BoQ sheet, group by any attached code system, subtotals per group, filters, line trace, calculation log, warnings, manual lines, quantity overrides with reason; "not in the models" notice with counts by source (P15); full line editing: overwrite quantity, text and unit, move between sections, reorder, exclude (P20); "How it is calculated" in plain words (P25) | F06 |
| Viewer | 3D view of the run's models; line → elements highlight; element → lines; colour by coverage / code group | F07 |
| Revisions | New model version → re-run → change report (lines and elements); compare any two runs | F08 |
| Workflow | Working version always editable; save versions (locked snapshots); confirm the BoQ when done, reopen; optional review and approval per org (P29); audit log | F09 |
| Library | Rule sets, classifications, dictionaries at system / org / project layer; versions with draft and publish; preview against a model version; code-list import from spreadsheets; item texts on codes, shown as line descriptions (P14) | F10 |
| Setup | Guided first setup: the essential measuring questions with a live preview, item list and item texts import, names, publish as the org's defaults (P16) | F16 |
| Exports | Excel BoQ (per run and frozen per saved version); edit the Excel and import the edits back; change report Excel. Pricing exports belong to the module | F12 |
| **Pricing module** (optional, removable, P36) | Vendors linked to orgs; pricebooks for firms and vendors; the firm's estimate on a separate Pricing tab; offer requests on a BoQ or part, offers filled from vendors' pricebooks, comparison (P32–P34) | F17, F20, F11 |
| Sharing | Public read-only share links per BoQ revision, revocable, with expiry (P26) | F18 |
| Admin console | Platform admin view of every org, user, seat, usage, activation funnel, limit hits; notes and tags for sales (P27) | F19 |
| Notifications | In-app (live) and email for job finished, needs input, versions and confirmations, review requests (when approval is on), pricing-module events | F13 |
| Plans | Free plan with limits, entitlements, usage events, billing provider adapter (no hard dependency on one provider) | F14 |
| i18n | English UI by default, more languages added as translations; org-customisable currency, units, number and date formats (P35) | F15 |

## Out of v1 (later, in rough order)

| Item | Why later |
|---|---|
| Support inbox and announcements in the admin console | After v1 (F19 "Later") |
| Vendor company accounts (several people pricing for one vendor) | One vendor account per person in v1 |
| Setup wizard: "start from your last BoQ" (suggestions read from an uploaded past BoQ) | Needs matching texts to kinds of line, likely AI-assisted (F16 "Later", Q23) |
| Formal tendering (packages, sealed bids, addenda, award) | Dropped (P34): offer requests in the pricing module instead |
| Construction phase: payment certificates, progress measurement, variations, final account | Out of scope: the product ends at a confirmed BoQ |
| Automatic or AI matching of pricebook items to BoQ lines | Manual picks, remembered (P33) |
| BCF issues to designers | Design-led users fix their own models (P06) |
| AI name suggestions | Settings exist in the engine, nothing built; questions cover it (09) |
| Coordinate alignment between models | Engine assumes shared coordinates; warning when they don't overlap |
| GAEB / ÖNORM / IfcCostSchedule export, client template import | Excel first; add per market |
| IDS input checks per preset | Parse checks and questions cover v1 |
| Teams (groups with roles) | Project membership per user is enough for v1 |
| Custom roles, SSO / SCIM | Enterprise tier |
| Pulling models from CDEs (ACC, Trimble Connect) | Upload only in v1 |
| Design options handling | Field measured, unused (docs/11) |
| Mobile layouts beyond read-only | Desktop-first work tool |
| Languages other than English | i18n-ready (P07) |
| On-premise packaging | Cloud only (P09) |

## v1 acceptance criteria

v1 is done when all of these pass on staging. Each is automated where marked (A) and
walked through by hand otherwise (M).

1. **Duplex reproduction (A).** Uploading `fixtures/ifc/Ifc2x3_Duplex_Architecture.ifc` and
   generating a BoQ with "As modelled" + "ACME cost codes" gives exactly the lines of
   `engine/tests/test_duplex.py` `HAND_BOQ`, through the full stack (upload → parse job → run
   job → lines API).
2. **Federation (A).** A two-model project (an architecture + structure pair from the corpus,
   docs/12) produces one BoQ with no double-counted elements and the overlaps reported as
   questions.
3. **Revision (A).** Uploading a modified version of a model, re-running and opening the change
   report lists exactly the added, removed and changed lines; earlier answers are applied
   without asking again.
4. **Traceability (M).** For any line, a user reaches its elements in the 3D view and its
   formula, parameters and per-element shares in two clicks or fewer.
5. **Versions (A).** A saved version cannot be changed by anyone, including an org owner
   (`409 revision_locked`); a confirmed BoQ refuses every write (`409 boq_confirmed`) until it
   is reopened; with approval switched on, saving needs an approval (F09).
6. **Pricing module (A + M), only if the module ships in v1** (it is for a later phase, P48). A firm imports a pricebook, prices
   the Duplex BoQ from it and from a vendor's shared list, sends two sections to two vendors,
   one answers in the browser from their pricebook and one by Excel; the comparison shows both
   offers and the estimate. With the module removed from the build, criteria 1–5 and 7–17 still
   pass unchanged (P36).
7. **Library (M).** An org library editor creates a rule set on "As modelled", changes three
   settings, previews against the Duplex, publishes; a new BoQ using it shows the changed
   numbers; BoQ versions saved earlier are unchanged.
8. **Isolation (A).** Automated tests prove a member of org X cannot read any resource of org Y,
   a project viewer cannot edit, and a vendor cannot read anything but their own invitations,
   the lines sent to them and their own pricebooks.
9. **Limits (A).** A free-plan org hitting a limit gets a clear `402 limit_reached` with the
   limit name; the UI shows what was hit and how to upgrade.
10. **Performance (A).** The NFR targets in `04-architecture/nfr.md` hold on the reference
    files.
11. **i18n (A).** A pseudo-locale build shows no hard-coded English strings in the app shell,
    sheet, questions, Library, share page and (with the module) vendor screens.
12. **First setup (M).** A person new to the app runs the setup wizard (F16) on the sample
    Duplex in under 15 minutes and gets a BoQ whose Excel shows their item numbers and filled
    item texts, with the "not in the models" note.
13. **Editing (A).** Two people editing the same BoQ see each other's edits live (P31). On the Duplex: one quantity edit, one text edit, one move to another
    section, one exclusion and one manual line survive a new model version; an Excel edited and
    imported back gives the same edits (F06, F12).
14. **Vendors (A + M, pricing module).** A vendor linked to two orgs answers an offer request
    from each, sees nothing else of either, and each org sees only its own link and lists (F17).
15. **Share link (A).** A link opens with no account, shows only what was included, and stops
    working within a second of being revoked (F18).
16. **Single session (A).** A second sign-in of the same account asks to take over, and the
    first device is signed out after confirming (F01 §10).
17. **Admin console (A).** Its numbers match the orgs' own usage pages, and no response
    contains project content (F19).
