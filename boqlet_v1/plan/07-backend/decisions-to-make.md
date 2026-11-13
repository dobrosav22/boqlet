# Backend decisions for the backend owner (BE-000)

The backend belongs to its **backend owner**: the person who runs the phase-2 session, either the
product owner or a backend developer they bring in (P47). Everything in this file is put to
them in BE-000 (`08-delivery/tasks-backend.md`), **including the decisions the plan has
already made**. The plan's choices are defaults and recommendations, not constraints. The
backend agent analyses each item first (`review.md`), then asks. **No backend code before the
answers are recorded.**

There are two lists:
- **Open (D1–D9):** decisions nobody has taken yet.
- **Already in the plan (B1–B16):** to confirm or change.

The analysis may add items to either list.

**Fixed for BE-000.** These are not the backend owner's alone, because the frontend is
already built on them:
- the HTTP contracts (`packages/api/openapi.yaml`, `packages/pricing-api/openapi-pricing.yaml`)
  and the shared suites (`tests/contract`, `tests/scenarios`);
- the product decisions and business rules (`plan/README.md` P-decisions about the product,
  `03-domain/business-rules.md`);
- the engine's rules of the road (`CLAUDE.md`).

If a backend choice needs a change there, it goes to the product owner, with its cost to the
frontend and the mock. If they agree: contract first, then the mock and the suites, then the
backend. When the backend owner is the product owner, both are decided in the same session,
but each is recorded where it belongs.

**Recording.** Every answer goes into `07-backend/decisions.md`: id, question, answer
(confirmed, changed to …, or deferred until …, with the reason), who decided, date.
Platform-level answers (auth provider, language and framework, database, hosting) also get a
P-number in `plan/README.md` and a row in `docs/02-decisions.md`. Only D1 changes frontend code
(the auth adapter, FE-043); a changed B-item may change backend tasks, which BE-000 then
rewrites.

## D1. Authentication provider (required, P10)

What the product needs: verified email; sign-up open to the public; passwordless or very low
friction for **vendors** (pricing module); invitation acceptance by email match; later enterprise SSO (SAML/OIDC
per org) and MFA; EU data residency possible; cost at 2k users + 5k vendors.

| Option | For | Against |
|---|---|---|
| **Keycloak** (self-hosted) | Free, full control, SSO/SAML/MFA built in, data stays in our cloud | We run and upgrade it; theming effort; another service to secure |
| **Auth0 / Okta CIC** | Mature, enterprise SSO, passwordless, good SDKs | Price grows with MAU (vendors count as users); vendor lock-in |
| **Clerk** | Fastest UI integration with Next.js, passwordless, orgs | US-centric; enterprise SSO in higher tiers; MAU pricing |
| **AWS Cognito / Azure AD B2C / Google Identity Platform** | Cheap at scale, fits if that cloud is chosen | Rougher developer experience; ties to the cloud (P09 says neutral) |
| **Spring Security, own users** | No vendor, no MAU cost | We build sign-up, verification, reset, passwordless, MFA and SSO ourselves; security burden |

Recommendation: **Keycloak** if the team is comfortable running it (neutral, no MAU cost for
vendors, SSO ready). Otherwise **Auth0**. Ask the owner.

Consequences to confirm with the answer: token vs cookie session (affects the frontend
adapter), how vendors sign in (magic link?), where the sign-in UI lives (hosted
page vs embedded), and how the backend's **single active session** (BR-54, P22) is bound to
the provider's sign-in: a session id in an `HttpOnly` cookie set after authentication, or a
`sid` claim. Prefer a provider whose sessions can be revoked by API, so a takeover also ends
the provider session.

## D2. Java framework

| Option | For | Against |
|---|---|---|
| **Spring Boot 3 (Java 21)** | Largest ecosystem, Spring Security, Spring Data JDBC/JPA, OpenAPI generator support, most hires know it | Heavier, slower start (irrelevant for long-running services) |
| Quarkus | Fast start, lower memory, good dev mode | Smaller ecosystem; fewer people know it |
| Micronaut | Similar to Quarkus | Same |

Recommendation: **Spring Boot 3 on Java 21** (virtual threads for SSE and I/O).

## D3. Persistence style

JPA/Hibernate vs Spring Data JDBC vs jOOQ. Recommendation: **jOOQ or Spring Data JDBC** with
explicit SQL for the heavy parts (bulk line ingestion via `COPY`, cursor paging), and Flyway
migrations. Avoid JPA lazy-loading surprises on large line tables.

## D4. Job queue

Postgres job table with `FOR UPDATE SKIP LOCKED` (doc 10, engine-worker.md) vs a broker
(RabbitMQ, SQS, Redis streams). Recommendation: **Postgres table** for v1. The worker contract
doesn't change if a broker comes later.

## D5. Cross-instance events (SSE fan-out)

Postgres `LISTEN/NOTIFY` vs Redis pub/sub. Recommendation: **Postgres LISTEN/NOTIFY** in v1
(one less service). Move to Redis if instance count or event rate grows.

## D6. Email provider

Postmark, SendGrid, Amazon SES, Mailgun, Resend, or SMTP. Behind an adapter either way.
Recommendation: whichever the owner already has an account with. **Postmark** otherwise
(transactional focus, good deliverability).

## D7. Billing provider confirmation

Paddle is likely (P08). Paddle acts as merchant of record (handles VAT/sales tax worldwide),
which suits an international product. Confirm before implementing the adapter. The `manual`
adapter ships first regardless.

## D8. Hosting provider and region

Cloud-neutral by design (P09). Needed before staging exists: provider, region (EU
recommended for European pilots), managed Postgres and S3-compatible storage choice, container
platform (Kubernetes vs simpler PaaS). Recommendation: a provider with managed Postgres + S3 +
containers in one EU region. **Ask, don't assume.**

## D9. Spreadsheet generation location (confirm)

The plan puts all spreadsheet I/O in the Python worker (engine-worker.md: core workbooks and the pricing module's `pricing.*` jobs,
import_offer, export_comparison) so there is one implementation for the mock and Java
phases. The alternative is Apache POI in Java. Confirm the worker approach.

---

## Already in the plan: confirm or change (B1–B16)

Each was decided while writing the plan, without the backend owner. For each, the analysis
(`review.md`) states:
- what the plan says, and why;
- what phase 1 showed (build log, the mock's implementation);
- the alternatives, and the risks and costs;
- which tasks change if it changes.

| # | Decision in the plan | Where | Typical alternatives |
|---|---|---|---|
| B1 | **Java** for the backend (P12, docs/02 D62) | README, 07-backend/architecture.md | Kotlin on the JVM; another language (the contract and suites are language-neutral, but every BE task's wording changes) |
| B2 | **Modular monolith**: one deployable, modules own their tables, talk through interfaces | 07-backend/architecture.md | Separate services; fewer, coarser modules |
| B3 | **Postgres** as the only database; schema, keys (UUID v7 from the application), constraints | 07-backend/db-schema.md | Other key strategy; partitioning plan for the large run tables |
| B4 | **Run results ingested into tables** (`run_lines`, `run_line_elements`, …) for paging, grouping and filters | 07-backend/architecture.md, db-schema.md | Keep `result.json.gz` in storage and query it in memory or with JSONB; hybrid |
| B5 | **The engine stays a Python worker** with the JSON job contract; no engine logic in the worker (D61) | 04-architecture/engine-worker.md | Engine behind an internal HTTP service only; parts ported to Java later |
| B6 | **Two engine transports**: HTTP (mock, small deployments) and a Postgres queue table; separate `engine-rpc` service for quick calls | engine-worker.md, deployment.md | Queue only; rpc through the queue; a broker (ties to D4) |
| B7 | **S3-compatible object storage**, the key layout, signed URLs (5 min), direct browser uploads | 04-architecture/storage-jobs-realtime.md, security.md | Uploads through the API; other expiry |
| B8 | **SSE** for live updates (ring buffer, `Last-Event-ID`; a hint to refetch, never the source of truth) | storage-jobs-realtime.md | WebSockets; polling |
| B9 | **Live co-editing per line**, the later edit wins, the other person is told (P31) — the backend part: version per line, conflict events | 03-domain, F06 §13–14 | Optimistic locking with ETags only; row locks (behaviour is fixed by P31, the mechanism is open) |
| B10 | **Tenant isolation in the application**: every repository query filtered by `org_id` through one helper; cross-tenant answers `404` | security.md | Postgres row-level security as well, or instead |
| B11 | **Single active session** (BR-54) as a `sessions` table checked by a request filter | tasks-backend.md BE-027, security.md | Bound to the auth provider's sessions (ties to D1) |
| B12 | **API code generated from the contract**: OpenAPI generator, server interfaces + DTOs | tasks-backend.md BE-001 | Hand-written controllers checked by the contract suite |
| B13 | **The pricing module as a separate build module** with its own schema `pricing` and extension interfaces (P36) | 04-architecture/modules.md, BE-031, BE-P* | Package-level separation inside one module (the removability rule P36 itself is fixed) |
| B14 | **Deployment shape**: containers `web`, `api`, `engine-worker` pools, `engine-rpc`; scheduler inside `api` with leader election; Flyway on deploy | 04-architecture/deployment.md | Fewer services; scheduler as its own process; another migration tool |
| B15 | **Observability**: structured logs, OpenTelemetry, the metrics and alerts listed | deployment.md, BE-025 | A specific vendor stack |
| B16 | **The order and split of the backend work**: BE-000 → engine (ME) → M5 → M6 → M7 → MP2, the task list as written | 08-delivery/milestones.md, tasks-backend.md, tasks-engine.md | Java first, engine alongside; other task cuts (the phase-2 exit criteria stay: the same suites green against Java) |

