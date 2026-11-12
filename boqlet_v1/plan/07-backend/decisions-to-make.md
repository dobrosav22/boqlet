# Decisions the backend agent must ask about first

**Stop and ask the owner before writing backend code.** Present each decision below with the
options and the recommendation. Record the answers in `plan/README.md` (decisions table,
P-numbers from P14 on) and in `docs/02-decisions.md`. Only D1 changes frontend code (the auth
adapter). The others are backend-internal.

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
