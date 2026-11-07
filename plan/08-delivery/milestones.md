# Milestones

Frontend first against the mock and the real engine (P11), then the Java backend replaces the
mock. Engine tasks run alongside, because the mock needs the worker contract early.

```text
M0 Contract + scaffolding ─► M1 Core loop (FE) ─► M2 Library (FE) ─► M3 Revisions + workflow (FE) ─► M4 Tendering (FE)
        │                                                                                              │
        └─► EN-001 worker HTTP ─► EN-002..EN-008 ─────────────────────────────────────────────────────┤
                                                                                                       ▼
                     M5 Backend core (Java) ─► M6 Queue workers + realtime ─► M7 Tenders, email, billing (Java) ─► M8 Hardening + deploy
```

| # | Milestone | Contents | Exit criteria |
|---|---|---|---|
| **M0** | Contract and scaffolding | FE-001…FE-004, EN-001, TS-001 | `packages/api/openapi.yaml` lints; Next app and mock start with `npm run dev:app`; mock answers `GET /me` for seeded users; engine HTTP transport parses and runs the Duplex with inline presets; CI runs lint, typecheck, engine tests, contract tests |
| **M1** | Core loop on the mock | FE-005…FE-016, FE-042, EN-003, EN-004, EN-007 | FL-1 and FL-2 up to "run complete" work end to end with real engine numbers; Duplex reproduction through the stack (v1 criterion 1) passes against the mock; sheet, questions, viewer, overrides, manual lines |
| **M2** | Library | FE-017…FE-021, FE-040, FE-041, EN-005, EN-010, EN-011 | FL-6 and FL-1 step 6 (setup wizard) work; v1 criteria 7 and 12 pass against the mock |
| **M3** | Revisions, workflow, exports, notifications | FE-022…FE-028, EN-002, EN-006 (xlsx part), EN-008 | FL-3 works; v1 criteria 3, 4, 5 pass against the mock |
| **M4** | Tendering | FE-029…FE-036, EN-006 (package/import/comparison) | FL-4 and FL-5 work; v1 criterion 6 passes against the mock |
| **M5** | Backend core (Java) | BE-000 (decisions), BE-001…BE-012 | Contract suite green for tags me, orgs, projects, models, library, decisions, boqs, adjustments, runs, diffs, exports, jobs; frontend runs against Java on staging for M1–M3 flows |
| **M6** | Queue workers and realtime | EN-009, BE-013…BE-015 | Jobs flow through Postgres; heartbeat re-queue tested; SSE across two API instances; the frontend uses Java exclusively on staging |
| **M7** | Tenders, notifications, entitlements, billing (Java) | BE-016…BE-022 | Contract suite fully green; v1 criteria 6, 9 pass against Java |
| **M8** | Hardening and deploy | BE-023…BE-026, FE-037…FE-039, TS-002…TS-004 | All v1 acceptance criteria pass on staging; security isolation suite green; NFR targets measured; production deployed |

Parallelism: the frontend owner works M0–M4 in order. Engine tasks can be taken by another
agent in parallel once EN-001 lands. Backend agents start M5 after M4 or earlier if
resourced. The contract is stable by then, so backend work doesn't block frontend work.

Rule for every task: update `docs/11-roadmap-and-open-questions.md` ("Done" and "Known
limitations") and the plan's status table when a milestone's exit criteria are met.
