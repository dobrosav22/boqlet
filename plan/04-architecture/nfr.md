# Non-functional requirements (v1 targets)

Measured on staging with the reference files (fixtures and corpus, docs/12). Size classes as
in docs/10.

## Model processing

| Model | Example | Parse (first upload) | Run (cached parse) |
|---|---|---|---|
| Small: < 1k elements, < 20 MB | Duplex (2.4 MB, 218 elements) | ≤ 30 s | ≤ 5 s |
| Medium: 10k–50k elements, 50–300 MB | NBU office pair, corpus medium files | ≤ 5 min | ≤ 60 s |
| Large: 200k+ elements, > 300 MB | Enterprise only | ≤ 30 min (large pool) | ≤ 5 min |
| Federated medium pair | NBU Medical Clinic (18 + 19 MB): ~2.5 min today | ≤ 3 min both parses in parallel | ≤ 60 s |

- Max upload size: per plan, absolute v1 cap 1 GB per version.
- Queue wait (p95) for interactive runs: ≤ 10 s on the standard pool at expected load.
- Engine memory: a medium run fits in 16 GB (meshes of all models are held during
  federation, docs/11). Large runs go to the large pool.

## API and UI

| Item | Target |
|---|---|
| CRUD API latency | p95 ≤ 300 ms |
| Lines page (500 lines) | p95 ≤ 500 ms |
| Run ingestion (50k lines) | ≤ 10 s |
| First contentful paint (app shell, warm) | ≤ 1.5 s |
| BoQ sheet: 20k lines | smooth scroll (virtualised); group switch ≤ 300 ms client-side |
| Viewer: Duplex interactive | ≤ 3 s warm |
| Viewer: 50k elements | ≤ 15 s to interactive; picking ≤ 100 ms |
| Live update latency (job finished → UI) | ≤ 2 s |
| (Pricing module) vendor request page load (500 lines) | ≤ 2 s |
| Live edit visible to other users of the BoQ (P31) | ≤ 1 s |

## Capacity (v1 planning numbers)

- 200 orgs, 2,000 users, 5,000 vendors (pricing module).
- 50 concurrent active users, 10 concurrent parse jobs, 30 runs/min peak.
- Storage: ~5 GB per active project per year (versions + artifacts + results).

## Availability and recovery

- 99.5% monthly for web + API (business hours matter most; maintenance windows announced).
- Jobs survive worker crashes (heartbeat re-queue). No job is lost on deploy.
- RPO 1 h, RTO 4 h.

## Browser support

Latest two versions of Chrome, Edge, Firefox, Safari. Desktop first (≥ 1280 px). Read-only
views (saved BoQ version, share page, vendor request page) usable at ≥ 768 px. Vendor pricing works at ≥ 1024 px. WebGL2
required for the viewer (fallback message otherwise).

## Accessibility

WCAG 2.2 AA for the app shell, forms, sheet, share page and vendor pages: keyboard reachable, visible
focus, labels, contrast, no colour-only signals (flags in comparison and coverage use icons or
patterns as well). The 3D viewer is exempt but has keyboard shortcuts and a non-3D element list.

## Quality gates

- Duplex acceptance test green in the engine and through the full stack (v1 criterion 1).
- Contract tests: mock and Java pass the same OpenAPI-based suite (08-delivery/testing.md).
- No `serious`/`critical` axe violations on the main screens.
