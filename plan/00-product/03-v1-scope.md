# 03 v1 scope

## In v1

| Area | In scope | Feature |
|---|---|---|
| Accounts | Public sign-up, create organisation, invite members, org roles, multi-org membership | F01 |
| Projects | Create, settings (currency, units, locale, default presets), project members and roles, archive | F02 |
| Models | Several discipline models per project, versions, upload with progress, parse job, input-check report, discipline and scope rules per model | F03 |
| BoQ | Several BoQs per project; inputs (model versions + presets); runs as background jobs; needs-input state | F04 |
| Questions | All engine question kinds; answer, dismiss, bulk answer; project decisions carried across versions and BoQs; promote name answers to the company dictionary | F05 |
| Sheet | Virtualised BoQ sheet, group by any attached code system, subtotals per group, filters, line trace, calculation log, warnings, manual lines, quantity overrides with reason; "not in the models" notice with counts by source (P15) | F06 |
| Viewer | 3D view of the run's models; line → elements highlight; element → lines; colour by coverage / code group | F07 |
| Revisions | New model version → re-run → change report (lines and elements); compare any two runs | F08 |
| Workflow | Draft → in review → approved → issued (locked); optional four-eyes; audit log | F09 |
| Library | Rule sets, classifications, dictionaries at system / org / project layer; versions with draft and publish; preview against a model version; code-list import from spreadsheets; item texts on codes, shown as line descriptions and sent to bidders (P14) | F10 |
| Setup | Guided first setup: the essential measuring questions with a live preview, item list and item texts import, names, publish as the org's defaults (P16) | F16 |
| Tendering | Tenders from issued revisions, packages, bidder invitations, bidder portal, offers, Excel round-trip, addenda, sealed bids, comparison, award per package | F11 |
| Exports | Excel BoQ (per run and frozen per issued revision), package Excel, comparison Excel | F12 |
| Notifications | In-app (live) and email for job finished, needs input, review requests, tender events | F13 |
| Plans | Free plan with limits, entitlements, usage events, billing provider adapter (no hard dependency on one provider) | F14 |
| i18n | English UI through an i18n layer; locale-aware numbers and dates; metric and imperial display; currency per project/tender | F15 |

## Out of v1 (later, in rough order)

| Item | Why later |
|---|---|
| Setup wizard: "start from your last BoQ" (suggestions read from an uploaded past BoQ) | Needs matching texts to kinds of line, likely AI-assisted (F16 "Later", Q23) |
| BCF issues to designers | Design-led users fix their own models (P06) |
| AI name suggestions | Settings exist in the engine, nothing built; questions cover it (09) |
| Coordinate alignment between models | Engine assumes shared coordinates; warning when they don't overlap |
| GAEB / ÖNORM / IfcCostSchedule export, client template import | Excel first; add per market |
| IDS input checks per preset | Parse checks and questions cover v1 |
| Teams (groups with roles) | Project membership per user is enough for v1 |
| Custom roles, SSO / SCIM | Enterprise tier |
| Client approval step in the app | Sign-off stays with the preparing firm in v1 |
| Clarification Q&A thread inside a tender | Use tender notes + email in v1 (see 09) |
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
5. **Workflow (A).** An issued revision cannot be changed by anyone, including an org owner
   (API returns `409 revision_locked`); changes require a new revision.
6. **Tender round (A + M).** From an issued revision: two packages, three bidders (one pricing
   in the browser, one by Excel upload, one declining), sealed until the deadline, comparison
   showing totals, per-line rates, lowest and median, missing rates; award of one package
   notifies all bidders of that package.
7. **Library (M).** An org library editor creates a rule set on "As modelled", changes three
   settings, previews against the Duplex, publishes; a new BoQ using it shows the changed
   numbers; BoQs issued earlier are unchanged.
8. **Isolation (A).** Automated tests prove a member of org X cannot read any resource of org Y,
   a project viewer cannot see unissued revisions, and a bidder cannot read anything but their
   own invitations and the package lines sent to them.
9. **Limits (A).** A free-plan org hitting a limit gets a clear `402 limit_reached` with the
   limit name; the UI shows what was hit and how to upgrade.
10. **Performance (A).** The NFR targets in `04-architecture/nfr.md` hold on the reference
    files.
11. **i18n (A).** A pseudo-locale build shows no hard-coded English strings in the app shell,
    sheet, questions, tender and bidder screens.
12. **First setup (M).** A person new to the app runs the setup wizard (F16) on the sample
    Duplex in under 15 minutes and gets a BoQ whose Excel shows their item numbers and filled
    item texts, with the "not in the models" note.
