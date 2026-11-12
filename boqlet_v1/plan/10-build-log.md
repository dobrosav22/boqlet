# Build log

The memory of the build, kept by the agents that build it (P45). The specs say what to build.
This log says **where the build stands** and **what the agents decided along the way** that a
later agent needs to know and can't see in the specs. How sessions use it: `08-delivery/sessions.md`.

- **Current position** is rewritten by every session: after every task, and before the
  session ends or stops.
- **Entries** are added, newest first:
  - at the end of every milestone and phase;
  - when a session takes an implementation decision a later agent must know;
  - when it deviates from a spec.

  Entries are never rewritten; a later entry corrects an earlier one.

Not here: finished tasks one by one (`docs/11` "Done"), product decisions (the owner's,
`plan/README.md`), open questions (`09-open-questions.md`).

## Current position

| | |
|---|---|
| Phase | 1 (frontend on the mock), milestone M1 (core loop) |
| Role | Frontend agent |
| Last task done | FE-008 BoQ create, setup, generate (F04) (c5d3b33) |
| Next task | FE-009 BoQ sheet (F06 §1–5, 8–11) |
| Waiting for the owner | — |
| In progress (not committed) | — |
| Notes for the next session | Read the M0 entry below ("For the next agent"). In short: run npm in `boqlet_v1/`; `npm run dev:app` starts engine + mock + app; sign in at http://localhost:3000 as a seeded user; add mock handlers per operationId in `apps/mock-api/src/handlers/` and register them in `app.ts`; turn the scenario todos into tests as their tasks land. Whether Vercel builds previews of `v_1` was not checked (no Vercel access in the session). |

## Entry template

```markdown
### <YYYY-MM-DD> — <milestone or phase> (<role>)
- **Built:** task ids, first..last commit.
- **Exit criteria:** each one and how it was checked; criteria passed only on a fake marked "(fake)".
- **Decisions taken:** what was decided, why, and the file that shows it (libraries and versions,
  layout, internal interfaces).
- **Deviations from the spec:** what differs, why, and the spec that was changed or the question
  opened (Qnn).
- **Fakes:** rows added to or removed from `06-frontend/mock-api.md`.
- **Known issues and debt:** each with the task that should deal with it.
- **For the next agent:** anything that isn't obvious from the code and the specs.
```

## Entries

### 2026-11-12 — M1 decisions so far: FE-005…FE-007 (frontend agent)
- **Decisions taken:**
  - Project `permissions` keys are fixed in `03-domain/permissions.md` (FE-006); the mock computes
    them in `apps/mock-api/src/projects.ts`. Org-level gating uses `orgCan` from `GET /me` roles.
  - Mock error codes added where the contract left them open: `own_role`, `already_invited`,
    `email_mismatch`, `confirm_mismatch` (F01), `not_org_member`, `last_lead` (F02), `upload_missing`
    (F03). Java should use the same codes; the shared scenarios assert them.
  - The mock signs people up with `POST /_dev/users {name, email}`; the suites read invitation
    links from `/_dev/outbox` (`tests/support/mail.ts`). Java needs a test-only mail sink and a
    token strategy (`tests/support/users.ts`) after BE-000.
  - `node tests/run.mjs <suite> --mock` starts a private PoC engine (the venv's uvicorn, no reload,
    free port) and a fresh mock pointed at it; scenarios that parse need it.
  - Jobs in the mock: `apps/mock-api/src/jobs.ts` (one at a time per type, progress over SSE);
    model versions in `handlers/models.ts`. The app shows job progress from the `jobProgress`
    query, which SSE `job.progress` events overwrite.
  - Codegen keeps fields with a `default` optional (`defaultNonNullable: false`).
- **Deviations from the spec:** none beyond those listed in `docs/11` "Known limitations of the
  product build".
- **Known issues and debt:** the PoC sends `null` for optional `NameUse` fields (the mock drops
  them; EN-001's worker should omit them).
- **For the next agent:**
  - e2e: Playwright starts engine, mock and app (or reuses running ones); run with two workers;
    give every created model, project and org a unique name: tests run in parallel as the same
    seeded users and receive each other's notifications.
  - Forms that must not submit before hydration render after a client fetch (the mock sign-up form).
  - Audit action codes contain dots; message keys use underscores (`project_created`).

### 2026-11-12 — M0 Consolidation, contract and scaffolding (frontend agent)
- **Built:** FE-000, FE-001, FE-002, FE-003, FE-004, TS-001; 0921ea9..dfa66f0 (plus the record commits).
- **Exit criteria:**
  - The PoC runs from `boqlet_v1/` (`npm run dev:poc` served the app and the Duplex sample;
    `VITE_DEPLOYED=1 npm run build:poc` built; `api/index.py` loads the engine from
    `boqlet_v1/engine`). The live demo deploys from `main`, which is untouched (P46); a Vercel
    preview of `v_1` was **not checked** (no Vercel access from the session).
  - `packages/api/openapi.yaml` lints: `npm run api:lint`, CI job "Contract".
  - Next app and mock start with `npm run dev:app` (with the PoC engine): checked by hand,
    `GET /api/v1/me` through the Next proxy on 3000 answered for Marko.
  - The mock answers `GET /me` for seeded users: `tests/contract/me.test.ts` (every seeded user).
  - The mock runs the Duplex through the PoC engine: `apps/mock-api/test/engine.test.ts`, green
    locally and in CI (engine job, 19 passed, none skipped).
  - CI runs lint, typecheck, engine tests and the contract tests: `.github/workflows/ci.yml`,
    run 43253334880 green (contract, typecheck and build, e2e, engine, suites).
- **Decisions taken:**
  - Versions pinned and listed in `06-frontend/architecture.md` "Pinned versions" (Next 16.4.6,
    React 19.3.1, Tailwind 4.3.5, Base UI 1.9.0, next-intl 4.15.1, TanStack Query 5.107.1,
    ESLint 9.39.5, Vitest 5.1.0, Playwright 1.65.0, Hono 4.13.18, openapi-typescript 7.13.0,
    openapi-fetch 0.17.0, Redocly 2.77.0).
  - shadcn/ui: the preset `b38miVKzY` decodes to style `base-mira`, Lucide, JetBrains Mono, radius
    small; colours and radius replaced by the guidelines' tokens in `apps/app/app/globals.css`.
    The registry's components import an npm package `cn`, which this repo doesn't take:
    components are added with `npm run ui:add -w @ifc-boq/app -- <name>` (the CLI's own dry run,
    `cn` pointed at `src/lib/utils.ts`). Local changes: `dialog.tsx` translates "Close",
    `button.tsx` is 32 px / 13 px.
  - i18n: next-intl without a locale in the URL; the cookie `boqlet-locale` holds the language;
    `en-XA` is generated from `messages/en` before dev, build and typecheck (git-ignored).
    Namespaces are listed in `src/i18n/config.ts`.
  - Theme: next-themes, default "system" (light unless the OS is dark), class on `<html>`.
  - Data layer: one `api` client (`src/api/client.ts`), `ApiError` thrown by middleware, global
    handlers registered by their owners (`src/api/global-errors.ts`), keys in `src/api/keys.ts`.
  - Mock: every `/api/v1` request is matched against the bundled contract, authenticated and
    validated before its handler; operations without a handler answer `501 not_implemented`;
    in dev every JSON response is validated (drift → 500). Unknown fields are rejected at the
    top level of a body only. Seed ids are stable (`seedId`); Olivia owns both Studio Demo and
    Small Firm (the seed table names no owner for Small Firm); a plan limit that is unlimited
    or "custom" is left out of `entitlements`.
  - The contract loader is `@ifc-boq/api/spec` (shared by the mock and the suites).
  - Suites: `tests/` is a workspace; `node run.mjs <suite> --mock` starts a fresh mock. The
    token strategy per backend lives in `tests/support/users.ts` (mock now, Java after BE-000).
- **Deviations from the spec:**
  - FE-001 created a minimal `apps/app` (shadcn needs a project to initialise); FE-002 built the
    skeleton on it.
  - TS-001 "one scenario per state machine run green": the scenario suite has one group per
    state machine, but only the clock scenario runs; each transition is an `it.todo` naming the
    task that builds the behaviour (the mock has no projects, models or BoQs yet). Those tasks
    turn their todos into tests.
  - SSE responses carry `Cache-Control: no-cache, no-transform` and `X-Accel-Buffering: no`
    (added to `05-api/conventions.md`): without `no-transform` the Next dev rewrite gzips and
    buffers the stream.
  - The 402 body's details are `limit`, `current`, `max` (conventions.md); FE-002's limit dialog
    first read `used` and was fixed in FE-003.
- **Fakes:** none yet (`apps/mock-api/src/engine/fakes/` holds only its README).
- **Known issues and debt:**
  - `OrgSettings.numberFormat.thousands` in `openapi.yaml` has no narrow no-break space (U+202F),
    the default F15 and the design guidelines name: fix the contract in FE-005 (org settings).
  - e2e runs against `next dev` with two workers (more make first visits time out); a production
    build would be faster in CI (FE-045 or earlier if it gets slow).
  - The start page (`/`) has its own query client (it sits outside the signed-in layout).
- **For the next agent:**
  - Run every npm command in `boqlet_v1/`. `npm install <pkg> -w <ws>` can fail on this machine
    with npm's "Cannot read properties of null (reading 'location')": add the dependency to the
    workspace's `package.json` by hand and run a plain `npm install`.
  - Vitest is started through `scripts/vitest.mjs` (app, mock) and `tests/run.mjs`, which
    upper-case a Windows drive letter in the cwd; started from Git Bash otherwise, Vitest loads
    itself twice and every suite fails.
  - Stopping servers on Windows: `Get-NetTCPConnection -State Listen` returns nothing on this
    machine; look up the owner of a port without `-State` and stop that process tree. A background
    `npm run dev:*` leaves its children (Vite, Next, tsx, uvicorn and its `spawn_main`) running
    after the parent stops.
  - Long shell heredocs with many files sometimes fail to parse in the Bash tool; write files
    with the editor tool instead.
  - `next dev` writes `apps/app/AGENTS.md` (Next's own agent notes); it is committed.
