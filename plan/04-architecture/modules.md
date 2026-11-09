# Core and modules: the pricing module is removable

The product has a **core** and, for now, one **module**: **pricing** (P36). The core is what the
product is: models → BoQ → editing → versions → export and share, with the Library, accounts,
billing and the admin console. The pricing module (vendors F17, offer requests F11, pricebooks
and estimates F20) is secondary: it can be switched off per org or platform, and it must be
possible to **delete it from the codebase without changing a line of core code**.

## The rule

**Dependencies point one way: the module depends on the core, never the reverse.** No core
code, table, schema, test, screen or API shape names a pricing concept. The module plugs into
the core only through the extension points and events below.

## Boundary, per layer

| Layer | Core | Pricing module |
|---|---|---|
| **API contract** | `openapi.yaml` | `openapi-pricing.yaml`, every path under `/pricing/`, its own tags. It may `$ref` core schemas (UserRef, Error, RunLine); core never refs it |
| **Frontend** | `apps/app` core routes and components | `packages/pricing-ui` (or `apps/app/src/modules/pricing`), registered at startup through the extension registry; its own route groups `/[org]/pricing/*` and `/vendor/*`; its own i18n namespace `pricing` |
| **Backend (Java)** | core modules (`orgs`, `projects`, `boqs`, …) | one module `pricing` with its own controllers, services and Policy. Talks to the core only through the core's public service interfaces (`BoqReadService`, `NotificationRegistry`, `AuditRegistry`, `EntitlementService`, `ExportDataService`) and core events |
| **Database** | core tables | Postgres schema `pricing` (tables `pricing.vendor_links`, `pricing.pricebooks`, …). Foreign keys only **from** `pricing` **to** core tables (`orgs`, `users`, `boqs`, `projects`), with `ON DELETE CASCADE`. Its own Flyway location (`db/migration-pricing`) so it can be left out. Dropping the schema leaves the core intact |
| **Engine (Python)** | parse, run, preview, diff, core exports | pricing spreadsheets in `engine/ifc_boq/sheets/pricing/` (offer request xlsx, offer import, comparison, pricebook template, priced BoQ) behind job types `pricing.*`; the core worker loads them only if present |
| **Mock API** | core handlers | a `pricing` plugin folder registered at startup |
| **Tests** | the core suites | separate suites; **the core suites run and pass with the module absent** (CI job "core only") |

## Extension points the core offers (generic, no pricing in their names)

| Extension point | What a module can add | Used by pricing for |
|---|---|---|
| `nav.orgItems` | an entry in the org's left navigation | Vendors, Pricebooks |
| `boq.workspaceTabs` | a tab in the BoQ workspace | Pricing (estimate), Offers |
| `sheet.selectionActions` | an action on selected lines / sections / elements | Request offers |
| `sheet.lineBadges` | a small badge on lines, from a module query | "sent to 3 vendors" |
| `settings.orgSections` | a section in org settings | pricing settings (stale price age, member editing) |
| `area.routes` | a separate area with its own layout and sign-in routing | the vendor area `/vendor` |
| `notifications.kinds` | notification kinds with i18n keys and email templates | `pricing.*` kinds (F13) |
| `audit.actions` | audit action names | `pricing.*` actions |
| `entitlements.keys` | limits and features in the plan table | `pricingModule`, `openOfferRequests`, `vendorsPerRequest` |
| `admin.metrics` | counters and funnel steps in the admin console (F19) | vendors, pricebooks, offer requests |
| `me.extensions` | extra fields on `GET /me` under a module key | `{pricing: {vendor: true, linkedFirms: 3}}` |
| `account.kinds` | an account kind with its own home after sign-in | vendor accounts |

Each extension point is a small typed registry in the frontend and an interface in the
backend. An empty registry is valid: the core renders and works with no modules.

## Core events the module listens to

`run.completed {boqId, revisionId, runId}`, `version.saved {boqId, revisionId, runId, label}`,
`boq.confirmed`, `boq.reopened`, `project.archived`, `org.deleting`, `user.deleted`,
`line_edits.changed {boqId, lineKeys}`. Delivered in-process (Java application events) and on
the same transaction commit; the module's handlers never block or fail a core transaction.

## Core read interface the module uses

- `BoqReadService`: lines of a run (key, position number, item number per classification, item
  text, unit, quantity, source, flags), selection resolution (codes, line keys, element GUIDs →
  line keys), the current run of a BoQ, saved versions.
- `ExportDataService`: the BoQ workbook data (rows, groups, header) so the module can produce the
  priced BoQ in the same layout.
- `IdentityService`: users, org membership and roles; the module keeps vendor profiles and links
  itself.

## Switching off and removing

- **Off for an org** (plan entitlement or org flag): module routes return `404` for that org,
  extension points render nothing, events are ignored for its BoQs, data is kept.
- **Off for the platform** (feature flag `modules.pricing`): the module isn't registered at all;
  vendor sign-in shows "not available".
- **Removal checklist:** delete `packages/pricing-ui`, the backend `pricing` module, the engine
  `sheets/pricing` folder, `openapi-pricing.yaml`, the `pricing` Flyway location and the mock
  plugin; drop the schema `pricing`; remove the module's plan entitlements. The core builds,
  migrates and passes its suites unchanged. A CI job builds and tests the core without the module
  on every change, so the boundary can't erode.
