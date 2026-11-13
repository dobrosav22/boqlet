# Milestones

Release 1 is the **full v1** (P37): every v1 acceptance criterion in `00-product/03-v1-scope.md`.
The pricing module (P36) is optional inside it and is built last in each phase.

The build runs in **three sequential phases** by **two agents** (P38): a frontend agent and a
backend agent. They never work at the same time, so everyone commits straight to the build branch `v_1` (P40, P46); `main` keeps the proof of
concept and its demo until the release merges `v_1` into it (FE-047). Sessions
run by `sessions.md` and hand over through `../10-build-log.md` (P45). All paths are relative
to the product root `boqlet_v1/` (P44).

```text
Phase 1 (frontend agent)     M0 ─► M1 ─► M2 ─► M3 ─► M4 ─► (MP1)        consolidate, app + mock API, engine features faked
Phase 2 (backend agent)      BE-000 ─► ME ─► M5 ─► M6 ─► M7 ─► (MP2)     backend owner's review, real engine, Java, staging
Phase 3 (frontend agent)     M8a ─► M8                                   wire to Java, drop fakes, harden, new root, release
```

## Phase 1: frontend on the mock (frontend agent)

The frontend and the mock API are built together. The mock is the backend's executable
specification: the contract and scenario suites written now are what the Java backend must pass
in phase 2. Computation goes to the **existing proof-of-concept engine API**
(`engine/ifc_boq/api.py`, started by `npm run dev:engine` in the product root); engine features that don't exist yet are
**faked in the mock** (P39), each fake listed in `06-frontend/mock-api.md` with the engine task
that replaces it. The frontend agent does not change `engine/`.

| # | Milestone | Contents | Exit criteria |
|---|---|---|---|
| **M0** | Consolidation, contract and scaffolding | FE-000…FE-004, TS-001 | The PoC runs from `boqlet_v1/` and the demo still deploys (FE-000); `packages/api/openapi.yaml` lints; Next app and mock start with `npm run dev:app`; mock answers `GET /me` for seeded users and runs the Duplex through the PoC engine; CI runs lint, typecheck, engine tests, contract tests |
| **M1** | Core loop | FE-005…FE-020 | FL-1 and FL-2 up to "run complete" end to end; v1 criterion 1 (Duplex reproduction) on the mock; sheet, questions, viewer, line edits, manual lines, explanations, sessions |
| **M2** | Library and setup | FE-021…FE-028 | FL-6 and the setup wizard work; v1 criteria 7 and 12 on the mock |
| **M3** | Versions, exports, sharing, notifications | FE-029…FE-037 | FL-2, FL-3, FL-9, FL-11 work; v1 criteria 3, 4, 5, 13, 15 on the mock |
| **M4** | Admin console, extension points, co-editing | FE-038…FE-040 | FL-12 works; v1 criteria 16, 17 on the mock; the app builds with no module |
| **MP1** | Pricing module on the mock (optional) | FE-P1…FE-P7, mock pricing plugin | FL-4, FL-5 work; v1 criterion 6; core suites pass with the module removed |

**Phase 1 is done** when M0–M4 exit criteria hold on the mock, `tests/contract` and
`tests/scenarios` cover every core operation and business rule, and the list of fakes in
`mock-api.md` is complete. Criteria that depend on a faked engine feature are marked
"(fake)" in the phase-1 run and re-checked in phase 3: v1 criteria 3, 12 and 13, F06 criteria 3
(derived lines following edits) and 5 (trace steps), F10 criteria 5, 7 and 8, F12 criterion 4.

## Phase 2: backend (backend agent)

| # | Milestone | Contents | Exit criteria |
|---|---|---|---|
| **BE-000** | Backend review and decisions (P47) | The agent analyses the backend plan (`07-backend/review.md`) and puts every backend decision to the backend owner: the open ones (D1–D9) and the ones the plan already made (B1–B16, `07-backend/decisions-to-make.md`); the plan is updated to the answers | Every item answered by the backend owner and recorded (`07-backend/decisions.md`; platform-level ones as P-numbers and in `docs/02`); backend plan and tasks updated; contracts and shared suites unchanged unless the product owner approved. **No backend code before this** |
| **ME** | Real engine | EN-001…EN-008, EN-010…EN-013 (EN-009 in M6, EN-P1 with MP2) | Every engine task's acceptance; `npm run test:engine` green incl. the Duplex test; the mock switched from the PoC API and its fakes to the worker (each fake deleted as its task lands) |
| **M5** | Backend core (Java) | BE-001…BE-012, BE-027, BE-031 | Contract and scenario suites green for the core tags against Java |
| **M6** | Queue workers and realtime | EN-009, BE-013…BE-015 | Jobs flow through Postgres; heartbeat re-queue tested; SSE across two API instances |
| **M7** | Sharing, admin, notifications, entitlements, billing, staging | BE-020…BE-024, BE-029, BE-030, BE-032 | Core contract suite fully green against Java; isolation suite green; `v_1` deploys to staging (BE-032) |
| **MP2** | Pricing module (optional) | EN-P1, BE-P1…BE-P4 | `openapi-pricing.yaml` suites green against Java; core-only build still green |

**Phase 2 is done** when the same contract and scenario suites that passed against the mock pass
against Java unchanged, the engine has no open EN task, and staging runs Java + worker (BE-032).

## Phase 3: integration and release (frontend agent)

| # | Milestone | Contents | Exit criteria |
|---|---|---|---|
| **M8a** | Wire up | FE-041…FE-043 | The app runs against Java on staging with the real auth adapter; every "(fake)" criterion from phase 1 re-checked green on the real engine; UI adjusted where real behaviour differs |
| **M8** | Hardening, new root, release | FE-044, FE-045, BE-025, BE-026, TS-002…TS-004, then FE-046, FE-047 | All v1 acceptance criteria pass on staging; NFR targets measured; `boqlet_v1/` is the repository root and nothing of the PoC is left (FE-046); `v_1` merged into `main`, production deployed from `main` and tagged `v1.0.0` (FE-047) |

BE-025 and BE-026 (observability, staging acceptance) are infrastructure the backend agent leaves
ready at the end of phase 2; the frontend agent runs them in M8. If phase 3 finds a backend bug,
it is fixed on `v_1` with a test, by whichever agent is active, and noted in `docs/11`.

## Rules for every task

- Read the task's specs first; build only what they say. A spec that is silent or contradictory
  goes to `plan/09-open-questions.md` and to the owner, not into a guess.
- A task is done when its acceptance criteria hold and `08-delivery/testing.md` "Definition of
  done" is met.
- Update `docs/11-roadmap-and-open-questions.md` ("Done" and "Known limitations") and the build
  log's Current position after each task. When a milestone's exit criteria are met, write its
  build-log entry and update the plan's status table (`plan/README.md`).
- Work on from milestone to milestone; stop only where `sessions.md` says to stop (P45).
