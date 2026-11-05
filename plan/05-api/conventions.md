# API conventions

Rules every endpoint in `openapi.yaml` follows. The mock API and the Java backend implement
them identically. Contract tests check them (08-delivery/testing.md).

## Contract workflow

1. `openapi.yaml` is the single source of truth for HTTP. Engine shapes are `$ref`s into
   `packages/types/schema` (D64).
2. Change the contract first, lint it
   (`npx @redocly/cli lint <path>/openapi.yaml --config plan/05-api/redocly.yaml`), regenerate
   the clients, then change code.
3. The frontend uses a client generated with `openapi-typescript` + `openapi-fetch`. The Java
   backend generates interfaces and DTOs with `openapi-generator` (spring or jaxrs-spec
   generator, interfaces only). The mock validates requests and responses against the file at
   runtime.
4. Versioning: the base path is `/api/v1`. Additive changes (new optional fields, new endpoints)
   are not breaking. Removing or renaming is breaking and needs `/api/v2` or a coordinated
   release (frontend and backend ship together in v1, so coordinated changes are acceptable
   before launch).

## Authentication

- `Authorization: Bearer <token>` from the auth adapter, **or** a secure session cookie,
  depending on the auth decision (P10). The contract declares bearer. A cookie session is an
  equivalent implementation the frontend adapter hides.
- Mock: `Authorization: Bearer mock:<userId>`, where the mock sign-in page picks a seeded user.
- Public endpoints (`security: []`): `GET /plans`, invitation previews by token, billing
  webhooks.

## Identifiers and URLs

- Ids are UUIDs (v7 recommended). Path parameters are ids, never slugs. Org slugs are a
  frontend routing concern, resolved through `GET /me` / `GET /orgs`.
- Values that are not URL-safe (line keys, question ids, GlobalIds) travel in query strings or
  bodies, never as path segments, except `guid`, which is IFC-safe base64.
- Nested resources are created under their parent (`POST /projects/{id}/models`) and then
  addressed flat (`GET /models/{id}`).

## Requests and responses

- JSON, UTF-8, `camelCase` fields. Timestamps ISO 8601 UTC with `Z`. Dates `YYYY-MM-DD`.
- **Money and rates are decimal strings** (`"1234.50"`) in tender endpoints (BR-47). Quantities
  are JSON numbers as the engine emits them (already rounded by the rule set).
- `PATCH` is a JSON merge patch (only the fields sent change). `PUT` replaces.
- Unknown fields in requests are rejected with `400 unknown_field` (catches client typos).
- Responses carry a `permissions` object on projects, revisions, presets and tenders (UI hints
  only; the server enforces anyway).

## Errors

Body: `{ "code": "snake_case_code", "message": "Human message (English, for logs)", "details": {…} }`.
The UI translates by `code` (with `details` as params). It shows `message` only as a fallback.

| Status | When | Example codes |
|---|---|---|
| 400 | invalid input | `invalid_body`, `unknown_field`, `not_ifc`, `offer_incomplete` |
| 401 | no or invalid credentials | `unauthenticated` |
| 402 | plan limit | `limit_reached` (+ `limit`, `current`, `max`) |
| 403 | role not allowed | `forbidden` (+ `required`), `four_eyes` |
| 404 | missing or not visible | `not_found` |
| 409 | blocked by state | `invalid_transition`, `revision_locked`, `project_archived`, `deadline_passed`, `line_in_other_package`, `draft_conflict`, `slug_taken`, `already_member`, `last_owner`, `not_ready`, `model_not_ready`, `sealed_until_close` |
| 413 | upload too large | `too_large` |
| 422 | engine refused a document | `preset_invalid` (+ `problems[]`) |
| 429 | rate limit | `rate_limited` (+ `Retry-After`) |
| 500/503 | server or engine unavailable | `internal`, `engine_unavailable` |

## Pagination

Cursor-based: `?cursor=&limit=` → `{ "items": [...], "nextCursor": "opaque" | null }`. Cursors
are opaque strings. Default limit 100, maximum 1000 (lines: up to 20,000 per page, see
`listLines`). Small bounded lists (members, models, packages) return plain arrays.

## Concurrency

- Mutable documents with concurrent editors (preset drafts, offer drafts) return an `ETag`
  and accept `If-Match`. A mismatch gives `409 draft_conflict` with the current version in
  `details`.
- State transitions are idempotent where natural: approving an approved revision returns
  `200` with the current state, not an error.

## Idempotency

`POST` endpoints that create jobs or send emails accept `Idempotency-Key` (UUID). The same key
within 24 h returns the first response. The frontend sets it for generate, export, open
tender, invite, submit offer.

## Long-running work

Endpoints that start work return `202` with a `Job` (or an object that includes it). Follow
the job by SSE (`job.progress`, `job.finished`) or by polling `GET /jobs/{id}` (fallback,
every 2 s with backoff). When a job finishes, its `output` holds public references
(`exportId`, `diffId`, `importReport`...). The subject entity (run, model version, export) is
also updated.

## Server-Sent Events

`GET /api/v1/events`, `text/event-stream`. Format per event:
```text
id: 01HF…
event: job.progress
data: {"jobId":"…","type":"run","subjectType":"run","subjectId":"…","projectId":"…","stage":"rules","pct":60}

```
Events: `job.progress`, `job.finished`, `notification.created`, `entity.changed`
(payloads in `04-architecture/storage-jobs-realtime.md`). Reconnect with `Last-Event-ID`.
Heartbeat comments every 25 s. Clients treat events as hints to refetch.

## Files

- Uploads go **directly to storage** with the `UploadInstructions` the API returns (signed
  PUT, or multipart parts over 100 MB), then a `complete` call. Exceptions: small multipart
  form uploads (≤ 20 MB) for code lists and offer imports go to the API.
- Downloads: `302` to a signed URL. The frontend follows the redirect with
  `window.location`/anchor for files, and with `fetch` for `scene.json`/`geometry.glb`.

## Localisation

`Accept-Language` is ignored for data. The API returns codes and params, not translated text
(P07). Emails are rendered server-side in the recipient's `locale` (English only in v1).

## Rate limits

Headers `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` on limited endpoints
(security.md lists them).
