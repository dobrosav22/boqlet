# Security and privacy

## Authentication

Provider undecided (P10). Whatever is chosen must give:
- OIDC/OAuth2 tokens the API can verify (JWT with `sub`, `email`, `email_verified`), or
  server sessions with an equivalent identity;
- verified email (required for invitation matching);
- passwordless email sign-in **or** an easy sign-up for bidders (F11 edge case);
- later: enterprise SSO (SAML/OIDC) per org, MFA.

The API maps `sub` → `User.authSubject` (just in time). It never stores passwords itself
unless the "Java-owned auth" option is chosen (then: Argon2id, rate limits, email
verification, reset flow: all in scope of that decision).

## Authorisation

- Every request resolves `(user, org)` context. Every repository query filters by `org_id`
  (and project membership where needed). A single helper/annotation does it, so a query
  can't forget (BR-50).
- Cross-tenant access returns `404`, not `403` (permissions.md).
- Bidder endpoints (`/bids/*`) use a separate access path: the invitation must belong to the
  user, and only package lines and the tender summary are readable.
- Signed URLs are issued only after the same checks. They are short-lived (security: 5 min
  GET, 1 h PUT) and scoped to one key.
- **Isolation test suite** (v1 acceptance 8): for every endpoint, automated tests with a user
  of another org, a project viewer, a guest and a bidder assert the expected `404`/`403`.

## Input handling

- IFC uploads: size limit per plan; first bytes must be `ISO-10303-21;`; parsed only in the
  worker, a separate process/container with no DB credentials beyond its job row, no
  network access except storage and the DB, CPU/memory limits and a timeout per job (parse:
  30 min default, large pool 2 h).
- Spreadsheets (code lists, bidder offers): parsed only in the worker/rpc with openpyxl in
  read-only, data-only mode (no formulas evaluated, no macros: `.xlsm` rejected). Size ≤ 20 MB.
- Attachments: any type, stored as-is, served with `Content-Disposition: attachment` and the
  original content type replaced by `application/octet-stream` for non-PDF/image types. Virus
  scanning through a pluggable scanner if the host offers one (ClamAV container otherwise,
  optional in v1).
- Formulas from users are evaluated only by the engine's safe evaluator (`expr.py`, never
  `eval`, D21).
- All JSON inputs are validated against the OpenAPI schemas (request validation middleware in
  the mock and in Java).

## Data protection

- TLS everywhere. HSTS on the web app.
- Encryption at rest: storage (SSE), database (provider-managed).
- Secrets via environment/secret manager, never in the repo.
- PII held: user name, email, IP in audit events, bidder company/contact. A data map lives in
  `07-backend/db-schema.md` (columns marked PII).
- GDPR basics: data processing agreement template for customers (legal, outside this repo),
  data export per org (owner: all projects, BoQs, decisions, exports as a zip, a background
  job, later), deletion per BR-52, user account deletion (removes PII, keeps audit
  references as "deleted user").
- Region: cloud-neutral (P09). The deployment chooses the region. EU hosting is recommended for
  European customers (doc 10).

## Web security

- CSP: `default-src 'self'`; `connect-src` the API, the SSE endpoint and the storage domain;
  `img-src 'self' data: blob:` and the storage domain; `worker-src blob:` for the viewer.
- Cookies (if sessions): `HttpOnly`, `Secure`, `SameSite=Lax`. With bearer tokens: no
  tokens in `localStorage` when the provider offers cookie-based sessions.
- CSRF protection for cookie auth (SameSite + Origin check on state-changing requests).
- Rate limits: auth endpoints (provider), invitations (20/h per org), bidder submissions
  (10/min per invitation), uploads (per plan), rpc calls (60/min per user).
- Webhooks: signature verification, replay window 5 min, idempotency by event id.

## Audit

Append-only audit events for every write (BR-51). Includes failed permission checks on
sensitive actions (issue, award, role change), webhook signature failures and sign-in from
new countries if the provider reports it.
