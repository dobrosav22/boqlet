# Deployment (cloud-neutral)

Everything runs as containers. Any provider with containers, a managed Postgres and S3-compatible
storage works (P09): AWS (ECS/EKS, RDS, S3), GCP (Cloud Run for web/API, GKE or VMs for
workers, Cloud SQL, GCS), Azure, Hetzner (VMs + k3s, managed Postgres, Object Storage), Fly.io,
Render.

## Services

| Service | Image | Scale | Resources (start) | Notes |
|---|---|---|---|---|
| `web` | Next.js (`apps/app`, standalone output) | 2+ | 0.5 vCPU, 512 MB | stateless; SSR only for the shell, no business logic |
| `api` | Java (`services/api`) | 2+ | 1 vCPU, 1–2 GB | stateless; SSE connections spread over instances |
| `engine-worker` | Python (`engine/`, `python -m ifc_boq.worker`) | 1–N per pool | standard: 4 vCPU, 16 GB; large: 16 vCPU, 64 GB | not serverless (D61); autoscale on queue depth per pool |
| `engine-rpc` | same image, `python -m ifc_boq.rpc` | 2 | 1 vCPU, 4 GB | internal only |
| `scheduler` | part of `api` (leader-elected) | 1 active | — | scheduled tasks (storage-jobs-realtime.md) |
| Postgres | managed | 1 primary (+ replica later) | 2 vCPU, 8 GB | PITR backups |
| Object storage | managed | — | — | lifecycle rules per prefix |
| Email | provider (adapter) | — | — | transactional, SPF/DKIM/DMARC on the sending domain |
| Billing | provider (adapter) | — | — | webhooks to `api` |

Phase 1 (frontend build) runs locally: `apps/app` + `apps/mock-api` + the engine HTTP
transport, all from `npm run dev:app` (06-frontend/mock-api.md). A shared demo of the frontend
on the mock can go to any Node host. The engine must run beside it (the Vercel demo of docs/17
shows the limits of serverless for the engine).

## Configuration (environment)

| Variable | Service | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | web | API base (`/api/v1` behind the same domain recommended) |
| `NEXT_PUBLIC_AUTH_ADAPTER` | web | `mock` \| the chosen provider |
| `DATABASE_URL` | api, worker | Postgres |
| `STORAGE_URL`, `STORAGE_BUCKET`, credentials | api, worker, rpc | S3 or `file://` |
| `ENGINE_RPC_URL` | api | rpc service |
| `ENGINE_POOLS` | worker | e.g. `standard` or `large` |
| `ENGINE_MAX_MODEL_MB` | worker | refuse bigger jobs (route to large pool) |
| `EMAIL_PROVIDER`, keys | api | adapter |
| `BILLING_PROVIDER`, keys, webhook secret | api | adapter (`manual` default) |
| `AUTH_*` | api, web | depends on the auth decision |
| `PUBLIC_APP_URL` | api | links in emails |

## Environments

`local` (developer machine), `staging` (production-like, seeded with the corpus reference
projects, used for v1 acceptance), `production`. Database migrations (Flyway) run on deploy
before the new API version takes traffic. Expand-and-contract for breaking schema changes.

## Routing

One public domain: `app.example.com` serves `web`. `/api/*` is routed to `api` by the load
balancer or ingress, so cookies and CSP stay same-origin. Storage via its own domain with signed
URLs (CORS: PUT/GET from the app origin only).

## Observability

- Structured JSON logs with `requestId`, `orgId`, `userId`, `jobId`.
- OpenTelemetry traces across web → api → worker (job id propagated in the envelope).
- Metrics: request rate/latency/errors per endpoint, queue depth and wait time per pool, job
  duration per type and size class, ingestion time, SSE connections, limit hits.
- Alerts: queue wait > 5 min (standard pool), job failure rate > 5%/h, API 5xx > 1%,
  DB connections > 80%, storage errors.
- Error tracking (Sentry or equivalent) for web and API.

## Backups and recovery

- Postgres: point-in-time recovery, 14 days. Daily restore test on staging (weekly in v1).
- Storage: versioning on the bucket for `uploads/`, `runs/`, `exports/`. Parse artifacts can be
  recomputed from `uploads/`.
- RPO 1 h, RTO 4 h for v1 (nfr.md).
