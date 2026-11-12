# F19 Platform admin console

## Purpose

One place for the people running the product (founders, sales) to see every org, user, seat
and how the product is used: who signed up, who got stuck, who hits limits and is ready to
upgrade. Later it also holds support messages (P27).

## Who

**Platform admins**: users with `User.platformRole = "admin"`. Set from the command line or a
database seed, never from the UI. v1 expects a single account; the model allows several.
The single-session rule applies (BR-54). MFA is required when the auth provider offers it.

## What it shows and what it doesn't

The console shows **account metadata, counts and usage**: orgs, plans, seats, members, project
and BoQ counts, jobs, limits hit, activation steps, vendors and share-link counts. It never
shows **project content**: models, BoQ lines, item texts, decisions, offers or prices, file
names or project names. Content access for support needs an explicit grant by the org's owner
(later, Q28). This keeps customer data private and makes the console safe to open in front of
a customer.

## Behaviour (`/admin`, its own layout, outside any org)

1. **Overview:** period selector (7 / 30 / 90 days, custom). Tiles with trend lines: sign-ups,
   new orgs, active orgs (any run in the period), orgs by plan, paying orgs, revenue from the
   billing provider's events when available, seats used / available, active projects, models
   parsed, runs, processing minutes, Excel exports, share-link views, BoQs confirmed;
   modules add their tiles through `admin.metrics` (pricing: vendors, pricebooks, offer requests).
2. **Activation funnel:** sign-up → org created → setup wizard finished → first model ready →
   first BoQ generated → first saved version → first export or share link. Conversion per step
   and median time between steps, by sign-up week (cohorts). Click a step to list the orgs
   stuck at it.
3. **Orgs:** table with name, country, plan, subscription status, trial end, seats used /
   limit, active projects / limit, processing minutes this month / limit, limit hits in the last
   30 days, last activity, created, owner email, tags. Sort, filter (plan, status, country, tag,
   "hit a limit", "inactive 30 days", "trial ends in 7 days"), search, CSV export.
4. **Org detail:** profile and settings; subscription (provider, status, period end, history of
   plan changes); effective entitlements with overrides; members (name, email, org role, last
   active, active session yes/no); counts (projects active / archived, models, versions, BoQs,
   runs, exports, share links, confirmed BoQs; module counters); usage per month and kind; limit
   events with time and limit; setup wizard progress; internal **notes** (timestamped, by whom)
   and **tags** for sales.
   Actions, each with a required reason and audited: change plan through the `manual` billing
   provider (F14), extend a trial, override an entitlement, suspend or reactivate the org.
5. **Users:** name, email, orgs and roles, vendor (yes/no, linked orgs), last sign-in, created.
   Action: end a user's active session (support case "I'm locked out on another device").
6. **Vendors:** vendor accounts, orgs linked, requests received, offers submitted.
7. **Health:** failed jobs per day, job duration percentiles, billing webhook failures, email
   bounces. Links to the ops dashboards (deployment.md).
8. **Later:** a support inbox (messages from an in-app "Contact us", threaded replies by
   email), announcements to all orgs or to orgs on a plan.

## Data

Read from the existing tables (orgs, memberships, subscriptions, usage events, jobs, audit
events, share links) plus whatever modules report through `admin.metrics`. New: `LimitEvent` (every `402`, for the "hit a
limit" signal), `AdminNote`, org `tags`, and `User.platformRole`. The funnel steps come from
audit events (`org.created`, `setup.completed`, `model_version.ready`, `run.completed`,
`version.saved`, `export.created`, `share_link.created`), first occurrence per org; modules add their own steps.
Aggregates may be computed nightly into a small reporting table; the overview tolerates a day
of delay, the org detail is live.

## Security (BR-57)

- `/admin/*` endpoints check `platformRole` on every request and return `404` to anyone else,
  so the console's existence isn't revealed.
- Every admin action and every view of an org's detail page writes an audit event with
  `actorKind: "platform_admin"`. Actions (not views) also appear in that org's own audit log.
- The admin role grants no access to org endpoints: an admin who wants to use the product
  signs up an org like anyone else.

## API

`GET /admin/overview`, `GET /admin/funnel`, `GET /admin/orgs`, `GET /admin/orgs/{orgId}`,
`PATCH /admin/orgs/{orgId}` (tags, suspend), `PUT /admin/orgs/{orgId}/subscription`,
`PUT /admin/orgs/{orgId}/entitlement-overrides`, `GET /admin/orgs/{orgId}/notes`,
`POST /admin/orgs/{orgId}/notes`, `GET /admin/users`, `DELETE /admin/users/{userId}/session`,
`GET /admin/health` (vendor statistics come from the pricing module: `GET /pricing/admin/vendors`), `GET /admin/orgs.csv`.

## Acceptance criteria

- [ ] A non-admin user calling any `/admin/*` endpoint gets `404` (isolation suite).
- [ ] The org table's seats, active projects and processing minutes equal the org's own usage page (automated on seed data).
- [ ] An org that hit `activeProjects` appears under "hit a limit" with the time of the hit.
- [ ] Changing an org's plan from the console needs a reason, takes effect at once, and shows in the org's audit log.
- [ ] No `/admin/*` response contains project names, file names, line descriptions or prices (automated check on seed data).
