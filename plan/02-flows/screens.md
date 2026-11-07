# Screens

Every screen of v1: route, who sees it, data, actions, and the states it must handle. Routes
are Next.js App Router paths (see `06-frontend/architecture.md`). `{org}` is the org slug,
other segments are ids.

All data screens must handle **loading** (skeletons, not spinners for whole pages), **empty**
(explains the next action), **error** (message + retry; `404` page for not found/no access),
and **read-only** (archived project, issued revision, insufficient role) states.

## Inventory

| ID | Route | Who | Data (API) | Main actions |
|---|---|---|---|---|
| S01 | `/sign-in`, `/sign-up` | public | auth adapter | sign in / up |
| S02 | `/onboarding` | user without org | `POST /orgs` | create org, invite |
| S03 | `/invite/[token]` | public → user | `GET /invitations/{token}` | accept |
| S04 | `/account` | user | `GET/PATCH /me`, notification prefs | edit profile, prefs, leave org |
| S05 | `/{org}` | member | projects, attention | open project, new project |
| S06 | `/{org}/projects/new` | member | entitlements, presets | create |
| S07 | `/{org}/projects/[p]` | project roles | project, models, boqs, tenders, activity | navigate |
| S08 | `/{org}/projects/[p]/models` | lead, estimator, approver, viewer | models + latest versions | add model, upload |
| S09 | `/{org}/projects/[p]/models/[m]` | same | model, versions | upload version, settings, scope |
| S10 | `/{org}/projects/[p]/models/[m]/versions/[v]` | same | version, summary, checks, names preview, viewer | retry, show in 3D |
| S11 | `/{org}/projects/[p]/boqs` | project roles | boqs with current revision | new BoQ |
| S12 | `/{org}/projects/[p]/boqs/[b]` | project roles (guests: issued only) | BoQ workspace (tabs below) | generate, submit, approve, issue, new revision |
| S12a | … `?tab=sheet` | | lines, warnings | group, filter, detail, override, add line |
| S12b | … `?tab=questions` | lead, estimator, approver | questions + decisions | answer, bulk, dismiss, promote |
| S12c | … `?tab=viewer` | all | geometry, scene, coverage | select, colour modes |
| S12d | … `?tab=changes` | lead, estimator, approver | diff | filter, export |
| S12e | … `?tab=log` | lead, estimator, approver | log | filter |
| S12f | … `?tab=setup` | lead, estimator (edit in draft) | revision inputs, presets | change inputs |
| S12g | … `?tab=exports` | all (guests: issued) | exports | export, download |
| S12h | … `?tab=history` | lead, estimator, approver | revisions, runs, review comments | open old run, compare |
| S13 | `/{org}/projects/[p]/decisions` | lead, estimator, approver | decisions | edit, clear, export CSV |
| S14 | `/{org}/projects/[p]/tenders` | lead, estimator, approver | tenders | new tender |
| S15 | `/{org}/projects/[p]/tenders/[t]` | same | tender, packages, invitations, status board, addenda | edit, open, addendum, extend, close |
| S15a | … `?tab=packages` | | packages, preview-selection, unassigned | build packages |
| S15b | … `?tab=bidders` | | invitations, address book | invite, remind |
| S15c | … `?tab=compare&package=[k]` | | comparison | normalise view, export, award |
| S16 | `/{org}/projects/[p]/library` | lead, estimator | project-layer presets | edit project dictionary / patches |
| S17 | `/{org}/projects/[p]/settings` | lead | project, members | edit, members, guests, archive |
| S18 | `/{org}/projects/[p]/activity` | lead, approver | project audit | filter |
| S19 | `/{org}/library` | members (edit: library editors) | presets by kind | new, open |
| S20 | `/{org}/library/[kind]/[presetId]` | same | preset, draft, versions, usage | edit, preview, publish, archive |
| S21 | `/{org}/settings/general` | owner, admin | org | rename, defaults, four-eyes |
| S22 | `/{org}/settings/members` | owner, admin | members, invitations | invite, roles, remove |
| S23 | `/{org}/settings/billing` | owner | billing, plans, entitlements | checkout, portal |
| S24 | `/{org}/settings/usage` | owner, admin | usage | — |
| S25 | `/{org}/settings/audit` | owner, admin | audit | filter, CSV |
| S26 | `/notifications` | user | notifications | mark read |
| S27 | `/bid-invite/[token]` | public → bidder | invitation preview | accept |
| S28 | `/bids` | bidder | my invitations | open |
| S29 | `/bids/[invitationId]` | bidder | tender, lines, offer | price, import, submit, withdraw, decline |
| S30 | `/{org}/setup` | owner, admin, library editor | org setup, presets, preview, names | setup wizard steps (F16), publish all |

Global chrome (all `/{org}` routes): top bar with org switcher, search (projects, BoQs, later
elements), notifications bell, user menu. Left nav: Dashboard, Projects, Library, Settings.
Inside a project: a project sub-nav: Overview, Models, BoQs, Decisions, Tenders, Library,
Activity, Settings. The bidder area (`/bids`) has its own minimal chrome, with no org
navigation.

## Wireframes

### S05 Dashboard
```text
┌ [Org ▾]  Search…                                                  🔔3  (A) ┐
│ Needs you                                                                   │
│  • Review requested: Tender BoQ Rev B — Riverside Housing        [Open]     │
│  • 12 questions: Cost check Rev A — Office K7                    [Answer]   │
│  • Tender "Shell & core" closes in 2 days, 2 of 5 submitted      [Open]     │
│ Projects                                          [+ New project]           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                         │
│  │Riverside     │ │Office K7     │ │+ Sample      │                         │
│  │3 models · 2  │ │1 model · 1   │ │  project     │                         │
│  │BoQs · tender │ │BoQ · 12 ?    │ │              │                         │
│  └──────────────┘ └──────────────┘ └──────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### S10 Model version report
```text
Architecture › v3 (ready) · Duplex_A.ifc · 2.4 MB · IFC2X3 · Revit 2011 · uploaded by Marko
Note: "after facade change"                                    [Viewer] [Retry]
┌ Storeys ───────────┐ ┌ Elements by class ───────────────┐ ┌ Checks ─────────────────────┐
│ Level 1   0.00     │ │ IfcWall 57 · IfcDoor 14 · …      │ │ ⚠ volume_mismatch  4  [3D]  │
│ Level 2   3.10     │ │ IfcSpace 19 · openings 31        │ │ ⚠ no_material      2  [3D]  │
└────────────────────┘ └──────────────────────────────────┘ └─────────────────────────────┘
Names preview with [dictionaries ▾]:  42 names · 37 resolved · 5 would be asked  [details]
```

### S12b Questions
```text
Questions (7 unanswered · 4 blocking)   Filter [kind ▾][model ▾][unanswered ☑]   [Regenerate (3 new answers)]
☐ BLOCKING  Material "BETON C25" — 14 elements                 [term: concrete › in situ ▾] [3D]
☐ BLOCKING  Material "Kalkzandsteen" — 31 elements             [term: ________ ▾]           [3D]
☐ BLOCKING  Overlap: Wall W-3 (Arch) ⨯ W-77 (Struct) 96%       (•) keep Structure ( ) keep both
☐ info      23 × IfcFurniture "Chair-Desk" not measured        [rule ▾ | exclude]
Selected 2 → [Apply same answer]   ☑ also add to project dictionary   [Promote…]
```

### S15c Comparison
```text
Package: Concrete works · Tender closed · 3 offers · ☐ fill missing with median (view only)  [Export] [Award…]
Ref    Description                 Unit  Qty     │ Alfa Bau      │ Beton d.o.o.  │ CityBuild    │ low   median
2.1.1  Strip footings C25/30       m³    16.53   │ 120.00  1,984 │ 112.50  1,860 │ 165.00 ⚠ 2,727│ 112.50 120.00
2.1.2  Ground slab 150             m²    210.40  │  38.00  7,995 │   — missing   │  41.00  8,626│  38.00  39.50
…
Total                                            │ 412,880 (2)   │ 398,100 (1)*  │ 455,900 (3)  │
* incomplete: 1 line without rate
```

### S29 Bidder package
```text
ACME Architects · Riverside Housing — Tender "Shell & core" · Package: Concrete works
Deadline: 14 Dec 2026 12:00 CET (your time 12:00)   Attachments: specs.pdf, drawings.zip
[Download Excel] [Upload priced Excel]                                 Draft saved 10:41
Ref    Description                 Unit  Qty     Rate        Amount     Note
2.1.1  Strip footings C25/30       m³    16.53   [ 120.00 ]   1,983.60  [   ]
2.1.2  Ground slab 150             m²    210.40  [  38.00 ]   7,995.20  [   ]
2.1.9  Sump (qty to be confirmed)  nr    —       [ 450.00 ]       —     [   ]
Total 412,880.00 EUR      Qualifications [ … ]   Valid until [ 2027-03-01 ]
[Decline]                                                         [Submit offer]
```
