# End-to-end flows

Each flow lists the steps a person takes, the screen, and the API calls. Diagrams show the
system interaction where it isn't obvious. Screens are defined in [screens.md](screens.md).

## FL-1 Onboarding: from sign-up to first project

| # | Actor | Step | Screen | API |
|---|---|---|---|---|
| 1 | Visitor | Sign up through the auth adapter | `/sign-up` | (auth provider) |
| 1a | User | After sign-in: if the account is open on another device, confirms the takeover (F01 §10) | `/session-conflict` | `POST /sessions` (`409 session_active` → `{takeover: true}`) |
| 2 | User | Lands in onboarding, names the org, picks currency / units / country. The org starts on the default tier (P17) | `/onboarding` | `GET /me`, `POST /orgs` |
| 2a | Owner | **Setup wizard, required** (F16, P18): how the firm measures, item numbers and texts, names. "Use the suggested answers" finishes in minutes | `/{org}/setup` | F16 API |
| 3 | Owner | Optional: invite colleagues (skip allowed) | `/onboarding` step 2 | `POST /orgs/{id}/invitations` |
| 4 | Owner | Empty dashboard with "Create your first project" and "Try with a sample project" | `/{org}` | `GET /orgs/{id}/projects` |
| 5 | Owner | Sample project: a copy of the Duplex project (model, BoQ, a few answered questions) to explore | `/{org}/projects/{p}` | `POST /orgs/{id}/projects?sample=duplex` |
| 6 | Owner | Later: refine the presets in the Library (guided mode, full editors or Excel templates, F10) | `/{org}/library` | Library endpoints |

The sample project doesn't count as an active project, and its processing doesn't count as usage.
Step 2a is required before the dashboard opens. Steps 3, 5 and 6 are optional. Previews run by
the wizard count as processing (BR-62), except on the sample Duplex.

## FL-2 Main loop: models to a confirmed BoQ

```mermaid
sequenceDiagram
  actor E as Estimator
  participant UI as Next.js app
  participant API as API (mock → Java)
  participant S as Object storage
  participant W as Engine worker
  E->>UI: Add model "Architecture", drop IFC
  UI->>API: POST /models/{m}/versions
  API-->>UI: version + presigned upload URL
  UI->>S: PUT file (progress)
  UI->>API: POST /model-versions/{v}/complete
  API->>W: enqueue parse job
  W->>S: read IFC, write parsed.json, geometry.glb, meshes.npz, scene.json
  W-->>API: job succeeded (summary, checks)
  API-->>UI: SSE job.finished, notification
  E->>UI: Create BoQ (defaults), Generate
  UI->>API: POST /projects/{p}/boqs, POST /revisions/{r}/runs
  API->>W: enqueue run job (resolved presets, decisions, adjustments)
  W->>S: write result.json, boq.xlsx
  W-->>API: job succeeded
  API->>API: ingest lines, questions, log; run = needs_input
  API-->>UI: SSE job.finished
  E->>UI: Answer questions (bulk), Regenerate
  UI->>API: POST /projects/{p}/decisions, POST /revisions/{r}/runs
  API-->>UI: run complete
  E->>UI: Review lines, explanations, viewer; edit lines; add preliminaries
  E->>UI: Regenerate, Save version "A" (note, not-in-the-models tick)
  UI->>API: POST /revisions/{r}/issue
  API->>W: export job (frozen Excel)
  API-->>UI: version A saved, new working version opened
  E->>UI: Later, when the BoQ is done: Confirm
  UI->>API: POST /boqs/{b}/confirm
```

Steps in words:
1. Models screen → add models → upload versions (F03). The user may leave. A notification
   arrives when the version is ready.
2. Read the input-check report. Fix bad exports in the authoring tool and upload again if
   needed (design firms, P01).
3. BoQs → New BoQ → setup prefilled → Generate (F04).
4. Questions tab → answer (bulk where possible) → Regenerate (F05).
5. Sheet → check lines, explanations and viewer, edit lines, add manual lines → Regenerate
   (F06, F07). Colleagues editing at the same time see each other's edits live (P31).
6. Save version (F09 §2). The frozen Excel is ready to download (F12). Work continues in the
   working version; save again at the next milestone.
7. Confirm the BoQ when it is done (F09 §5). With approval switched on, step 6 is submit →
   approve → save (F09 §4).

## FL-3 New model version → next saved version

| # | Actor | Step | Screen | API |
|---|---|---|---|---|
| 1 | Estimator | Uploads Architecture v2 (with a note) | model page | F03 calls |
| 2 | System | Marks BoQs using v1 "new version available", notifies | — | `boq.new_version_available` |
| 3 | Estimator | In the working version: "Use v2" | BoQ workspace | `PATCH /revisions/{r}` |
| 4 | Estimator | Generate. Only new questions appear. Answer them | Questions | runs, decisions |
| 5 | Estimator | Changes tab: report against version A. Checks the big deltas in the model (Changes colour mode) | Changes | `POST /runs/{run}/compare`, `GET /diffs/{d}/lines` |
| 6 | Estimator | Save version B (or submit it, with approval on) | BoQ workspace | F09 calls |

## FL-4 (Pricing module) Pricebooks and the firm's estimate

| # | Actor | Step | Screen | API |
|---|---|---|---|---|
| 1 | Library editor | Pricing › Pricebooks → New → download the empty template, fill it in Excel, upload, review, save | `/{org}/pricing/pricebooks` | `POST /pricing/orgs/{o}/pricebooks`, `/import` |
| 2 | Estimator | BoQ › Pricing tab → "Fill remembered prices" (nothing yet on a first BoQ) | Pricing tab | `POST /pricing/boqs/{b}/estimate/fill-remembered` |
| 3 | Estimator | For each line: "Pick a price" from our pricebook or a vendor's shared list; matches are remembered | Pricing tab | `GET /pricing/orgs/{o}/price-search`, `POST /pricing/boqs/{b}/estimate/lines/batch` |
| 4 | Estimator | Exports the priced BoQ | Pricing tab | `POST /pricing/boqs/{b}/estimate/export` |
| 5 | Estimator | Next project: the same item numbers fill themselves from the remembered matches | Pricing tab | fill-remembered |

## FL-5 (Pricing module) Offer requests

| # | Actor | Step | Screen | API |
|---|---|---|---|---|
| 1 | Member | Vendors → Invite vendor (email, company, trades) | `/{org}/pricing/vendors` | `POST /pricing/orgs/{o}/vendors` |
| 2 | Vendor | Opens the email, signs up (name, company); keeps a pricebook; chooses which list this firm sees | `/vendor-invite/[token]`, `/vendor/firms` | `POST /pricing/vendor-invitations/{t}/accept`, `PATCH /pricing/vendor/firms/{l}` |
| 3 | Estimator | Selects sections in the sheet (or elements in the model) → Request offers → vendors, optional deadline → Send | S12a | `POST /pricing/boqs/{b}/offer-requests` |
| 4 | Vendor | Opens the request: "Fill from my pricebook", picks prices for the rest (remembered for this firm), submits; or uses Excel | `/vendor/requests/[id]` | `/pricing/vendor/requests/*` |
| 5 | Estimator | Compares offers side by side with the estimate; copies one vendor's rates into the estimate | S15 | comparison, estimate |
| 6 | Estimator | The BoQ changes → "Send update" → vendors confirm their prices | S15 | `POST /pricing/offer-requests/{r}/updates` |

## FL-6 Library: encode the office standard

| # | Actor | Step | Screen | API |
|---|---|---|---|---|
| 1 | Library editor | Library → Rule sets → New → "Patch on As modelled" | `/{org}/library/rule_set/new` | `POST /orgs/{o}/presets` |
| 2 | | Settings tab: answers the questions their rulebook answers | editor | `PUT /presets/{id}/draft` (autosave, check) |
| 3 | | Preview on a project model: sees the lines change next to the editor | editor preview panel | `POST /presets/{id}/preview`, job, SSE |
| 4 | | BoQ items: adds a company item, edits a formula (readable form) | editor | autosave |
| 5 | | Publish v1 with a note | editor | `POST /presets/{id}/publish` |
| 6 | | Classifications → New → import the office code list from Excel → map items | classification editor | `POST /codelists/read`, `/build` |
| 7 | | Sets them as project defaults on new projects (org setting "starred presets") | Library | `PATCH /presets/{id}` (`starred`) |

The setup wizard (F16) is the short form of this flow for a new org: steps 1–3 and 6 with only
the setup questions, a live preview and one "Publish all".

## FL-7 Questions, the fast path

Unknown names are the most common blocker on real files (docs/11). The flow must be fast:
1. Questions tab, filter "Names", sorted by occurrences.
2. Multi-select rows with the same meaning → pick a term once (search with hierarchy,
   e.g. "concrete › in situ") → Apply. "Also add to project dictionary" is on by default.
3. Library editors see "Promote to company dictionary" on applied name answers.
4. Regenerate (one click, header).

## FL-8 Plans and limits

1. Free org hits `activeProjects` creating a second project → `402` → limit dialog.
2. Owner → "Upgrade" → plan cards → `POST /orgs/{o}/billing/checkout` → provider checkout →
   return URL → webhook updates the subscription → entitlements refresh → retry works.

## FL-9 Editing the BoQ with the model

| # | Actor | Step | Screen | API |
|---|---|---|---|---|
| 1 | Estimator | Opens the BoQ: sheet and model side by side (F07 §9) | S12a | lines, scene, geometry |
| 2 | | Filters by storey "Level 1" and code group "Walls": both sheet and model narrow | S12a | client-side |
| 3 | | Clicks a line: "How it is calculated" explains it; its walls light up | S12a | `GET /runs/{r}/lines/by-key` |
| 4 | | Edits the description, drags two lines into "Finishes", excludes one with a reason | S12a | `POST /boqs/{b}/overrides` |
| 5 | | Box-selects facade elements in the model → "6 lines" → move them to "Facade" | S12a | `POST /boqs/{b}/overrides/batch` |
| 6 | | Downloads Excel, a colleague edits it, imports it back, reviews and applies the edits (F12) | S12g | `POST /revisions/{r}/edits-import`, job |
| 7 | | Generates again: every edit is kept and shown as an edit | S12a | `POST /revisions/{r}/runs` |

## FL-11 Share a BoQ

| # | Actor | Step | Screen | API |
|---|---|---|---|---|
| 1 | Lead | BoQ workspace → Share → "This version as it is now", includes sheet, explanations, 3D; expires in 30 days → copy link | S12 | `POST /boqs/{b}/share-links` |
| 2 | Client | Opens the link without an account: reads the BoQ, clicks lines, turns the model | `/s/[token]` | `/public/shares/{token}/*` |
| 3 | Lead | Later revokes it; the client sees "This link is no longer available" | S12 | `DELETE /share-links/{id}` |

## FL-12 Platform admin

| # | Actor | Step | Screen | API |
|---|---|---|---|---|
| 1 | Admin | Overview for the last 30 days; activation funnel shows orgs stuck at "first model" | `/admin` | `GET /admin/overview`, `/admin/funnel` |
| 2 | Admin | Orgs filtered by "hit a limit": opens one, reads usage and limit events, adds a note and a tag | `/admin/orgs/[id]` | `GET /admin/orgs/{id}`, `POST …/notes` |
| 3 | Admin | Extends the org's trial by 14 days with a reason (audited, visible to the org) | `/admin/orgs/[id]` | `PUT /admin/orgs/{id}/subscription` |

