# F14 Entitlements, usage and billing

## Purpose

Public sign-up with a limited free plan. Paid plans through a payment provider the code doesn't
depend on (P08). Usage measured from day one.

## Design

```text
Plan (config) ──► Subscription (org) ──► Entitlements (effective limits) ──► checks in API
                         ▲                                                    │
   Billing adapter ──────┘  (webhook: plan changed, payment failed)           ▼
   (Paddle / Stripe / manual)                                          UsageEvent rows
```

- **Plans** are configuration (seeded table or config file): id, name, entitlements, public.
  Placeholder values are in `00-product/05-plans-and-limits.md`.
- **Subscription** per org: planId, status, trial, period end, provider refs, overrides.
- **Effective entitlements** = plan entitlements + overrides. `GET /orgs/{orgId}/entitlements`
  returns `{limits: {...}, usage: {...}, features: {...}}` for the UI.
- **Enforcement** happens in one backend service (`EntitlementService.check(org, limit, delta)`),
  called before: invite member, create project / unarchive, upload version, create run /
  preview, create preset, open tender, add bidder invitation. Failure → `402 limit_reached`
  (BR-60).
- **Usage events** are written by job completion (BR-62). Monthly processing minutes are
  aggregated from them.

## Billing adapter (provider-agnostic)

Interface the backend implements per provider:

| Operation | Purpose |
|---|---|
| `createCheckout(org, planId, returnUrl) → url` | Hosted checkout page of the provider |
| `createPortal(org, returnUrl) → url` | Hosted customer portal (cards, invoices, cancel) |
| `parseWebhook(request) → BillingEvent` | Verify signature; map to `subscription.activated`, `.changed`, `.past_due`, `.cancelled` |
| `syncSubscription(org)` | Pull current state (repair job) |

Also a `manual` provider for enterprise and pilots: an admin endpoint/CLI to set the plan.

The frontend only calls `POST /orgs/{orgId}/billing/checkout` and `/portal`, and redirects to
the returned URL. It never loads provider SDKs except where the provider requires an overlay
checkout. In that case it sits behind a `BillingClient` adapter in the frontend too.

## Screens

- `/{org}/settings/billing` (owner): current plan, status, renewal date, limits with usage
  bars, "Change plan" (plan cards → checkout), "Manage billing" (portal).
- `/{org}/settings/usage` (owner, admin): this month's processing minutes by project and by
  kind, seats, active projects.
- **Limit prompt** (any screen): on `402`, a dialog says which limit, current/max, and offers
  "Upgrade" (owner) or "Ask your owner" (others).
- Free-plan banner when exports carry a watermark.

## API

`GET /plans`, `GET /orgs/{orgId}/entitlements`, `GET /orgs/{orgId}/usage`,
`GET /orgs/{orgId}/billing`, `POST /orgs/{orgId}/billing/checkout`,
`POST /orgs/{orgId}/billing/portal`, `POST /webhooks/billing/{provider}` (provider → backend).

## Acceptance criteria

- [ ] Every limit in the plans table is enforced at the listed actions, and returns `402` with the limit name (automated per limit).
- [ ] Switching the provider from `manual` to a real adapter needs no frontend change.
- [ ] A webhook with an invalid signature is rejected and audited.
- [ ] Usage minutes on the usage page equal the sum of job durations for the month (automated).
