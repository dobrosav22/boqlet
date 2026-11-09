# 05 Plans and limits

Billing is provider-agnostic (P08). The backend owns **plans → entitlements → enforcement**
and records **usage events**. A payment provider (Paddle likely) only tells the backend which
plan an org is on, through an adapter (F14). All numbers below are **placeholders to tune**.
Code must read them from the plan table, never hard-code them.

## Commercial model (undecided, P17)

A new org starts on the **default tier** (`Plan.default = true`; "Free" in the placeholders).
The paid tiers and what they are priced on are not decided: levels by number of **active
projects**, by **seats**, or both. The entitlement engine (F14) must support any of these
without code changes: every limit is a row in the plan table, a missing limit means
unlimited, and a tier may limit only seats, only active projects, or both. Q18 and Q26 track
the decision.

## Principles (from docs/10, D50)

- **Never charge per BoQ generated.** Trying presets and comparing runs is a core strength.
- Charge for what tracks value and cost: **seats**, **active projects**, **processing** (big
  files cost real compute).
- Vendors and public-link visitors are always free and never count as seats.
- Record a usage event for every parse, run and preview from day one, even on the free plan.
- Regional price levels later. Prices are not in the product spec, only limits.

## Plans (placeholder limits)

| Entitlement | Free | Professional | Team | Enterprise |
|---|---|---|---|---|
| `seats` | 2 | 5 | 25 | custom |
| `activeProjects` | 1 | 10 | 50 | custom |
| `maxModelVersionMb` | 50 | 300 | 300 | custom |
| `maxModelsPerBoq` | 2 | 6 | 12 | custom |
| `processingMinutesPerMonth` | 60 | 1,000 | 5,000 | custom |
| `libraryOrgPresets` (per kind) | 1 | unlimited | unlimited | unlimited |
| `pricingModule` (feature, P32) | off | on | on | on |
| `vendorsPerRequest` (pricing module) | — | unlimited | unlimited | unlimited |
| `openOfferRequests` (pricing module) | — | 20 | unlimited | unlimited |
| `shareLinks` (feature) | yes, with "Made with" badge | yes | yes | yes |
| `approvalWorkflow` (feature: review, approval, four-eyes) | no | yes | yes | yes |
| `exportWatermark` (feature) | yes | no | no | no |
| `auditLogRetentionDays` | 30 | 365 | 365 | custom |

Definitions:

- **Active project**: status `active`. Archived projects stay readable and don't count.
- **Processing minute**: wall-clock minutes of parse, run and preview jobs, summed per calendar
  month (UTC). Export and diff jobs are not counted.
- A **limit check** happens before the action. Over a limit the API answers
  `402 Payment Required` with `{"code":"limit_reached","limit":"activeProjects","current":1,"max":1}`.
- Exceeding `processingMinutesPerMonth` blocks new parse/run/preview jobs, never reading,
  exporting, answering questions or acting on open offer requests.
- Downgrading never deletes data: excess projects become read-only until archived or upgraded;
  excess members keep access but no new invites can be sent.

## Trial

A new org starts on **Free**. A 14-day **trial of Team** may be switched on by plan
configuration (`trialPlanId`, `trialDays`). When it ends, the org drops to Free with the rules
above.

## Usage events

Every parse, run and preview job writes one `UsageEvent` when it ends:
`{orgId, projectId, jobId, kind, startedAt, durationMs, modelBytes, elementCount, outcome}`.
The org settings show usage for the current month against limits (F14).
