# Milestones

Frontend first against the mock and the real engine (P11), then the Java backend replaces the
mock. Engine tasks run alongside, because the mock needs the worker contract early.

```text
M0 Contract + scaffolding ─► M1 Core loop (FE) ─► M2 Library + setup (FE) ─► M3 Versions, exports, sharing (FE) ─► M4 Admin, extension points (FE)
        │                                                                                              │
        └─► EN-001 worker HTTP ─► EN-002..EN-008 ─────────────────────────────────────────────────────┤
                                                                                                       ▼
                     M5 Backend core (Java) ─► M6 Queue workers + realtime ─► M7 Sharing, admin, email, billing (Java) ─► M8 Hardening + deploy

   Optional, removable (P36):  MP1 Pricing module on the mock (after M3) ─► MP2 Pricing module in Java (after M7)
```

| # | Milestone | Contents | Exit criteria |
|---|---|---|---|
| **M0** | Contract and scaffolding | FE-001…FE-004, EN-001, TS-001 | `packages/api/openapi.yaml` lints; Next app and mock start with `npm run dev:app`; mock answers `GET /me` for seeded users; engine HTTP transport parses and runs the Duplex with inline presets; CI runs lint, typecheck, engine tests, contract tests |
| **M1** | Core loop on the mock | FE-005…FE-016, FE-042…FE-045, EN-003 (with full line edits), EN-004, EN-007, EN-013 | FL-1 and FL-2 up to "run complete" work end to end with real engine numbers; Duplex reproduction through the stack (v1 criterion 1) passes against the mock; sheet, questions, viewer, overrides, manual lines |
| **M2** | Library | FE-017…FE-021, FE-040, FE-041, FE-046, EN-005, EN-010, EN-011, EN-012 | FL-6 and FL-1 step 6 (setup wizard) work; v1 criteria 7 and 12 pass against the mock |
| **M3** | Versions, exports, sharing, notifications | FE-022…FE-028, FE-048, FE-049, EN-002, EN-006, EN-008 | FL-2, FL-3, FL-9, FL-11 work; v1 criteria 3, 4, 5, 13, 15 pass against the mock |
| **M4** | Admin console, extension points | FE-050, FE-051, FE-052 | FL-12 works; v1 criteria 16, 17 pass against the mock; the app builds with no module |
| **MP1** | Pricing module on the mock (optional) | FE-P1…FE-P7, EN-P1, mock pricing plugin | FL-4, FL-5 work; v1 criterion 6; core suites still pass with the module removed |
| **M5** | Backend core (Java) | BE-000 (decisions), BE-001…BE-012, BE-027, BE-031 | Contract suite green for the core tags; frontend runs against Java on staging for M1–M4 flows |
| **M6** | Queue workers and realtime | EN-009, BE-013…BE-015 | Jobs flow through Postgres; heartbeat re-queue tested; SSE across two API instances; the frontend uses Java exclusively on staging |
| **M7** | Sharing, admin, notifications, entitlements, billing (Java) | BE-020…BE-022, BE-029, BE-030 | Core contract suite fully green; v1 criteria 9, 15–17 pass against Java |
| **MP2** | Pricing module in Java (optional) | BE-P1…BE-P4 | `openapi-pricing.yaml` contract suite green; v1 criterion 6 against Java; core-only build still green |
| **M8** | Hardening and deploy | BE-023…BE-026, FE-037…FE-039, TS-002…TS-004 | All v1 acceptance criteria pass on staging; security isolation suite green; NFR targets measured; production deployed |

Parallelism: the frontend owner works M0–M4 in order. Engine tasks can be taken by another
agent in parallel once EN-001 lands. Backend agents start M5 after M4 or earlier if
resourced. The contract is stable by then, so backend work doesn't block frontend work.

Rule for every task: update `docs/11-roadmap-and-open-questions.md` ("Done" and "Known
limitations") and the plan's status table when a milestone's exit criteria are met.
