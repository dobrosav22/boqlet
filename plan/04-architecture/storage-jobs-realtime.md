# Storage, jobs and realtime

## Object storage

S3-compatible API (AWS S3, Cloudflare R2, MinIO, Hetzner, GCS interop). One bucket per
environment, private, server-side encryption on. Phase 1 uses a local folder with the same key
layout (`apps/mock-api/.data/blobs/`).

### Key layout

| Key | Written by | Lifetime |
|---|---|---|
| `orgs/{orgId}/uploads/{modelVersionId}/source.ifc` | browser (signed PUT) | while the version exists |
| `orgs/{orgId}/parses/{sha256}/parsed.json.gz`, `geometry.glb`, `meshes.npz`, `scene.json` | parse job | while any version references the hash (dedupe, BR-08) |
| `orgs/{orgId}/runs/{runId}/result.json.gz`, `boq.xlsx` | run job | while the run exists |
| `orgs/{orgId}/diffs/{diffId}/diff.json.gz` | diff job | cache, may be recomputed |
| `orgs/{orgId}/previews/{jobId}/…` | preview job | 7 days (lifecycle rule) |
| `orgs/{orgId}/exports/{exportId}/{fileName}` | export jobs | issued: while the revision exists; others: 90 days |
| `orgs/{orgId}/tenders/{tenderId}/attachments/{attachmentId}/{fileName}` | browser (signed PUT) | while the tender exists |
| `orgs/{orgId}/imports/{jobId}/{fileName}` | browser (signed PUT) | 7 days |
| `orgs/{orgId}/presets/{presetVersionId}/codelist.json.gz` | API | large code lists only |

Signed URLs: PUT valid 1 h, GET valid 5 min. `geometry.glb` and `scene.json` are served with
`Cache-Control: private, max-age=31536000, immutable` (their content never changes for a key).

### Upload flow (model version)

```text
UI ──POST /models/{m}/versions {fileName,sizeBytes}──► API: create version(awaiting_upload),
                                                          check limits, return signed PUT
UI ──PUT file (multipart for >100 MB, progress)──────► storage
UI ──POST /model-versions/{v}/complete──────────────► API: HEAD object (size), read first bytes
                                                          (ISO-10303-21), sha256 (from client or
                                                          computed by the parse job), dedupe or
                                                          enqueue parse
```
Multipart: the API returns `upload.parts[]` (one URL per part) when `sizeBytes > 100 MB`, and
`complete` takes the ETags.

## Jobs

Lifecycle in `03-domain/state-machines.md`. Contract in `engine-worker.md`.

API side of a job:
1. **Create:** insert `jobs` row (`queued`) in the same transaction as the subject change
   (e.g. `Run(queued)`), with `pool` and `priority` (interactive runs priority 0, parses 5,
   exports 3, previews 1).
2. **Watch:** `LISTEN job_finished` (Java) or polling every 1 s as a fallback. Progress rows
   are relayed to SSE subscribers of the org/project.
3. **Ingest** on success, in one transaction per job type:
   - parse → update `ModelVersion` (summary, artifacts, `ready`), model `latestVersionId`,
     notifications;
   - run → read `result.json.gz`, bulk insert `run_lines`, `run_line_elements`,
     `run_questions`, `run_warnings`, `run_log_entries`, set run status, move
     `revision.current_run_id`, notifications;
   - diff → `run_diffs` row with summary and key;
   - exports → `exports` row;
   - import_offer → draft offer lines.
4. **Usage event** for parse/run/preview (BR-62), any outcome.
5. **Failure:** retryable errors are re-queued automatically (max 3, backoff 10 s × attempt).
   Others mark the subject failed, notify, and are audited.

Run ingestion target: 50k lines + 500k line-element rows in under 10 s (COPY/batch insert).

## Realtime: Server-Sent Events

`GET /api/v1/events` (`text/event-stream`), authenticated like any request (cookie or bearer:
the frontend uses `fetch`-based SSE so it can send the header). One stream per browser tab.

Events (`event:` name, `data:` JSON):

| Event | Data | Sent to |
|---|---|---|
| `job.progress` | `{jobId, type, subjectType, subjectId, projectId, stage, pct, message}` | users with access to the project (throttled 1/s per job) |
| `job.finished` | `{jobId, type, status, subjectType, subjectId, projectId, error?}` | same |
| `notification.created` | `Notification` | the recipient |
| `entity.changed` | `{entityType, entityId, projectId?, change: "created" \| "updated" \| "deleted"}` | users with access |

- `id:` on every event; on reconnect the client sends `Last-Event-ID`, and the server replays
  the last 5 minutes from a ring buffer (per instance; with several API instances, events go
  through Postgres `NOTIFY` or Redis pub/sub so every instance can deliver them).
- Heartbeat comment every 25 s.
- The frontend maps `entity.changed` and `job.finished` to TanStack Query invalidations (see
  `06-frontend/architecture.md`). SSE is a hint to refetch. Correctness never depends on
  receiving an event.

## Scheduled work (system actor)

| Task | Every | Action |
|---|---|---|
| Close tenders | 1 min | `open` tenders past deadline → `closed`, notifications |
| Deadline reminders | 15 min | 24 h before deadline: firm + bidders not submitted |
| Expire invitations | 1 h | org invitations past `expiresAt` |
| Re-queue dead jobs | 1 min | heartbeat older than 2 min |
| Clean abandoned uploads | 1 h | `awaiting_upload` older than 24 h |
| Usage near limit | 1 h | 80% → `limit.near` |
| Billing sync | 1 day | adapter `syncSubscription` for non-manual orgs |
