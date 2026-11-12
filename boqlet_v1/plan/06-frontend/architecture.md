# Frontend architecture

The product frontend lives in `apps/app` (new). It is a **UI only**: no business logic, no
quantity computation (BR-01), no direct engine access. It talks to the API in `openapi.yaml`
(mock first, Java later) through a generated client.

## Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router)**, React 19, TypeScript strict | Next.js **16.4.6**, React **19.3.1** (pinned in FE-001). `output: "standalone"` for containers |
| Data fetching | **TanStack Query v5** + `openapi-fetch` client generated with `openapi-typescript` | Server state lives only in the query cache |
| Realtime | SSE via `@microsoft/fetch-event-source` (sends auth headers) | One connection per tab, in the app layout |
| Tables | **TanStack Table v8 + TanStack Virtual** | BoQ sheet, comparison, decisions, audit |
| Forms | react-hook-form + zod (form-level validation only) | Server validation is the authority |
| URL state | `nuqs` (typed search params) | Tabs, filters, grouping, selected line |
| Client state | React state; Zustand only for the Library editor drafts and viewer selection | Port of `apps/web/src/library/store.ts` |
| i18n | **next-intl** (ICU) | `messages/en/*.json`, pseudo-locale `en-XA` |
| Styling | **shadcn/ui** from preset `b38miVKzY` (Tailwind CSS 4 + Base UI primitives, components kept in the repo), tokens from `design-guidelines.md`; fonts JetBrains Mono (UI) and Inter Tight (display), self-hosted via `@fontsource-variable/*` | **Decided (P23, P43)** |
| 3D | three.js (port of `apps/web/src/viewer`) | Lazy-loaded route chunk |
| Decimals | `big.js` | Pricing module amount display only; the backend computes the stored amounts (BR-47) |
| Tests | Vitest + Testing Library; Playwright e2e against mock API + engine | 08-delivery/testing.md |
| Lint | ESLint (next, typescript, `react/jsx-no-literals` or `i18next/no-literal-string` for UI text), Prettier | No literal UI strings (F15) |

### Pinned versions

Set in FE-001; change them deliberately and update this table.

| Package | Version | Where |
|---|---|---|
| `next` | 16.4.6 | `apps/app` |
| `react`, `react-dom` | 19.3.1 | `apps/app` (the PoC `apps/web` stays on React 18 until FE-046) |
| `tailwindcss`, `@tailwindcss/postcss` | 4.3.5 | `apps/app` |
| `@base-ui/react` | 1.9.0 | `apps/app` (shadcn/ui style `base-mira`, preset `b38miVKzY`) |
| `shadcn` | 4.23.0 | `apps/app` (only for `shadcn/tailwind.css`; components are added with `npm run ui:add -w @ifc-boq/app -- <name>`, see below) |
| `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `lucide-react` | 0.7.1, 2.1.1, 3.7.0, 1.4.0, 1.72.0 | `apps/app` |
| `openapi-typescript` | 7.13.0 | product root (`npm run api:gen`) |
| `openapi-fetch` | 0.17.0 | `packages/api`, `packages/pricing-api` |
| `@redocly/cli` | 2.77.0 | product root (`npm run api:lint`) |
| `next-intl` | 4.15.1 | `apps/app` (no locale in the URL; the cookie `boqlet-locale` carries the user's language) |
| `@tanstack/react-query` | 5.107.1 | `apps/app` |
| `@tanstack/react-table`, `@tanstack/react-virtual` | 8.21.3, 3.13.12 | `apps/app` (the BoQ sheet, FE-009: Table owns the columns and their visibility, Virtual the rows; both are skipped by the React Compiler, see the `incompatible-library` comments) |
| `next-themes`, `sonner` | 0.4.6, 2.0.8 | `apps/app` (theme class on `<html>`, default "system"; toasts) |
| `@fontsource-variable/jetbrains-mono`, `@fontsource-variable/inter-tight` | 5.3.0 | `apps/app` (self-hosted, every subset incl. Latin Extended and Cyrillic) |
| `eslint`, `eslint-config-next` | 9.39.5, 16.4.6 | `apps/app` (ESLint 10 is not supported by `eslint-plugin-react` yet) |
| `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `jsdom` | 5.1.0, 6.3.0, 16.3.3, 31.0.0 | `apps/app` (`npm run test` goes through `scripts/vitest.mjs`, which upper-cases a Windows drive letter in the cwd; Git Bash otherwise makes Vitest load itself twice) |
| `@playwright/test` | 1.65.0 | `apps/app` (`npx playwright install chromium` once per machine) |
| TypeScript | 5.x (5.9 installed) | every workspace; `apps/app/tsconfig.json` maps `react` to its own `@types/react` 19 (the PoC hoists 18) |

**shadcn components.** The registry's `base-mira` components import `cn` from an npm package
named `cn`; this repo doesn't take that dependency. `apps/app/scripts/ui-add.mjs` fetches a
component (and its registry dependencies) from `https://ui.shadcn.com/r/styles/base-mira/`,
points `cn` at `src/lib/utils.ts` (the classic clsx + tailwind-merge helper) and prints any npm
dependency still to add. Don't run `npx shadcn add` directly: it tries to install `cn`.
Local changes to added components (re-applied by hand after `ui:add --overwrite`): `dialog.tsx`
translates its "Close" text (`common.close`); `button.tsx` default and icon sizes are 32 px with
13 px text (the guidelines' control density).

## Rendering model

- The app is behind authentication and is data-heavy. Pages are **client components that fetch
  through TanStack Query**. Server Components are used for layouts, static chrome and the
  public pages (sign-in shell, invitation previews).
- **No Next.js route handlers with business logic.** Next serves the UI. The API is a separate
  service (same domain, `/api/v1` routed to it), so swapping mock → Java changes only
  `NEXT_PUBLIC_API_BASE_URL` (P11).
- Next middleware is allowed only to redirect unauthenticated users to `/sign-in`, when the
  auth adapter exposes a cookie the middleware can check.

## Folder structure

```text
apps/app/
  app/
    (public)/sign-in/[[...rest]]/page.tsx
    (public)/sign-up/[[...rest]]/page.tsx
    (public)/invite/[token]/page.tsx
    (public)/s/[token]/page.tsx       # share link (F18)
    (public)/session-conflict/page.tsx
    (app)/layout.tsx                   # auth gate, SSE connection, QueryClientProvider, IntlProvider
    (app)/onboarding/page.tsx
    (app)/account/page.tsx
    (app)/notifications/page.tsx
    (app)/[org]/layout.tsx             # org chrome: top bar, left nav, org resolution by slug
    (app)/[org]/page.tsx               # dashboard
    (app)/[org]/projects/new/page.tsx
    (app)/[org]/projects/[projectId]/layout.tsx      # project sub-nav
    (app)/[org]/projects/[projectId]/page.tsx
    (app)/[org]/projects/[projectId]/models/…
    (app)/[org]/projects/[projectId]/boqs/[boqId]/page.tsx   # workspace with ?tab=
    (app)/[org]/projects/[projectId]/decisions/page.tsx
    (app)/[org]/projects/[projectId]/library/…
    (app)/[org]/projects/[projectId]/settings/page.tsx
    (app)/[org]/projects/[projectId]/activity/page.tsx
    (app)/[org]/library/…
    (app)/[org]/settings/{general,members,billing,usage,audit}/page.tsx
    (app)/[org]/setup/page.tsx         # setup wizard (F16)
    (admin)/admin/…                    # platform admin console (F19), own layout
  src/
    api/            schema.d.ts (generated), client.ts, keys.ts (query keys), hooks/<resource>.ts, errors.ts
    auth/           AuthAdapter.ts, adapters/mock.tsx, adapters/<provider>.tsx (after the decision)
    realtime/       sse.ts (connect, reconnect, Last-Event-ID), invalidation.ts (event → query keys)
    features/       one folder per feature: projects, models, boq-sheet, questions, viewer, changes,
                    versions, library (ported), sharing, setup, settings, billing, notifications, admin
    extensions/     the extension registries (nav, workspace tabs, selection actions, line badges,
                    settings sections, areas, notification kinds); empty by default
packages/pricing-ui/ (pricing module, removable, P36)
  src/register.ts  registers its routes ([org]/pricing/*, /vendor/*, /vendor-invite/[token]),
                   tabs, actions, badges, nav items and i18n namespace with the core registries
  src/…            vendors, pricebooks, estimate, offer requests, vendor area
    components/     design-system components (design-system.md)
    i18n/           config, formatters (numbers, units, currency, dates)
    lib/            permissions.ts, units.ts, decimal.ts, download.ts
    viewer/         ported three.js viewer
  messages/en/*.json, messages/en-XA/ (generated pseudo-locale)
```

## Data layer rules

1. **Generated types only.** No hand-written API types. `npm run api:gen` regenerates
   `src/api/schema.d.ts` from `packages/api/openapi.yaml`. Engine types (`BoqLine`,
   `Question`, `RuleSet`...) come from `@ifc-boq/types` when a component needs the engine
   shape directly (Library editors).
2. **Query keys** are centralised in `src/api/keys.ts`: `['project', id]`, `['run', id, 'lines', params]`...
3. **Immutable data is cached forever:** runs that finished, their lines/questions/log, model
   versions that are `ready`, preset versions that are published, scene/geometry
   (`staleTime: Infinity`). Mutable lists use `staleTime` 30 s plus SSE invalidation.
4. **SSE → invalidation map** (`realtime/invalidation.ts`):
   - `job.finished {type: "parse", subjectId}` → `['modelVersion', subjectId]`, `['models', projectId]`
   - `job.finished {type: "run"}` → `['revision', …]`, `['runs', revisionId]`, `['boq', …]`
   - `entity.changed {entityType, entityId}` → that entity and its parent lists
   - `notification.created` → `['notifications']` + toast when relevant
5. **Mutations** use optimistic updates for decisions, overrides, manual items, offer draft
   rates and notification reads. They roll back on error and show the translated error.
6. **Errors:** one `ApiError` class with `code`, `details`, `status`. Global handling: `401` →
   `auth.signIn({returnTo})`; `402` → `<LimitDialog>` (F14); `404` → route `notFound()`;
   `409 revision_locked` and other state conflicts → a toast and refetch. Everything else →
   inline error with retry.
7. **Permissions:** `can(resource.permissions, "approve")` for UI gating, from the API's
   `permissions` objects. Org-level from `GET /me`. Never infer permissions from roles in more
   than one place (`lib/permissions.ts`).

## Auth adapter

```ts
export interface AuthAdapter {
  /** "loading" until the provider has restored a session. */
  useSession(): { status: "loading" | "authenticated" | "anonymous"; email?: string; name?: string };
  /** Bearer token for API calls, or null when the provider uses cookies. */
  getAccessToken(): Promise<string | null>;
  signIn(opts?: { returnTo?: string; email?: string }): Promise<void>;
  signUp(opts?: { returnTo?: string; email?: string }): Promise<void>;
  signOut(): Promise<void>;
  /** Optional embedded UI for providers that render forms in-app. */
  SignInPage?: React.ComponentType;
  SignUpPage?: React.ComponentType;
}
```
- `mock` adapter: a sign-in page listing seeded users. The token is `mock:<userId>`, kept in
  `sessionStorage`.
- The real adapter is written after the auth decision (07-backend/decisions-to-make.md). No
  component imports a provider SDK directly.

## BoQ workspace (the heaviest screen)

- Route `/{org}/projects/{p}/boqs/{b}?rev=&tab=&line=&group=`. Default: the current
  revision, Sheet tab.
- Loads `boq` → `revision` → `currentRun` → `lines` (one request up to 20k lines; above that
  server-side grouping), in parallel with `questions` count and `warnings`.
- Grouping by code path is done client-side with memoised selectors. For 20k lines, run
  it in a Web Worker if profiling shows > 100 ms.
- Selection (line keys, element GlobalIds) is shared between sheet, detail panel and viewer
  through a small Zustand store, mirrored to `?line=`.
- The viewer is a lazy chunk. It loads `geometry.glb` for each input model version and
  `scene.json`, `coverage` for the run.

## Library (port)

The PoC Library (`apps/web/src/library/*`) is the most valuable UI code in the repo. Port it
into `features/library` (reuse-from-poc.md): keep its components and plain-language
"story" helpers, and replace its data access (`api.ts`, `presets/user` saves) with the new
endpoints (drafts, publish, versions, preview). Its CSS (`library.css`) is re-expressed in the
design system.

## Performance budgets

- Initial JS for `/{org}` ≤ 250 KB gzip. Viewer, Library editors and the comparison grid are
  separate chunks.
- Sheet: 60 fps scroll at 20k rows (virtualised rows, fixed row height, no per-row
  subscriptions).
- Lighthouse performance ≥ 80 on the dashboard (warm API).

## Environment

| Variable | Example |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `/api/v1` (proxied in dev to the mock on `http://localhost:4010`) |
| `NEXT_PUBLIC_AUTH_ADAPTER` | `mock` |
| `NEXT_PUBLIC_SENTRY_DSN` | optional |

In dev, `next.config` rewrites `/api/v1/*` to the mock (or Java) so cookies and CSP behave as
in production (same origin).

## Modules (P36)

The app imports `packages/pricing-ui` in exactly one place (`src/modules.ts`), and only when the
build flag `MODULE_PRICING` is set. Core code never imports from a module; modules import core
components, hooks and the generated core client. A lint rule (`no-restricted-imports`) forbids
`@ifc-boq/pricing-ui` anywhere but `src/modules.ts`. CI builds the app with and without the
module.
