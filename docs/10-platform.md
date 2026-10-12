# 10 Platform

Everything around the engine that a product needs: projects and model versions, combining
several models, people and permissions, background jobs, notifications, performance and pricing.
**None of this is built.** It was designed in conversation; the Java backend (D62) will own most
of it. Originals: `reference/knowledge-base-2026-10-03.md` sections 12-15 and
`reference/conversation/part2` (turns 52-59) and `part3` (turns 61-67).

## Data model

A project is the container. IFCs are versions of discipline models. BoQs belong to the project
and reference the model versions and the preset snapshot they used. (The first idea, a project
folder of IFCs each with several BoQs from different presets, fits inside this with four
refinements below.)

```text
Organization (billing unit; owns everything)
 ├─ Members (users; a user can belong to several orgs) + Teams
 ├─ Company knowledge
 │    ├─ Rule sets (presets: system / org / project scope, versioned)
 │    ├─ Classifications (code lists + maps)
 │    ├─ Dictionaries (company layer) + resolution settings
 │    ├─ Item libraries, client templates (future)
 │    └─ Rate libraries, waste / conversion factor sets (future; pricing)
 └─ Projects
      ├─ Metadata: client, location, currency, locale, default presets, status (draft / active / archived), team
      ├─ Models (Architecture, Structure, MEP...)  + discipline tag + scope rules
      │    └─ Versions: IFC file (kept for re-processing), tool, schema, upload date, sha256,
      │                 parse result (ParsedModel + geometry), input-check result
      ├─ Decisions (answers to questions; project layer; some promoted to company)
      ├─ Dictionary (project layer)
      └─ BoQs
           ├─ Inputs: which model versions (one or several)
           ├─ Preset snapshot: the exact flattened rules, classifications, dictionaries used
           ├─ Runs (immutable): RunRequest + BoqResult + calculation log
           ├─ Lines: measured / derived / manual / flagged, linked to element GUIDs
           ├─ Status: draft -> in review -> approved -> issued (locked)
           ├─ Revisions (an issued BoQ changes only by a new revision)
           └─ Exports: frozen files, who and when
Cross-cutting: jobs (status, progress, errors), usage events (processing metering),
audit log, approvals / sign-off records, comments.
```

### The four refinements

1. **IFCs are versions of a model, not loose files.** Project > Model > Versions (v1, v2, v3).
   Enables change tracking and carrying decisions over (GlobalIds are stable; question ids are
   deterministic).
2. **A BoQ does not belong to one IFC.** One BoQ is often built from architecture v3 +
   structure v2, so it belongs to the project and references its inputs.
3. **Answers live at project level** (and company level above), reused by every BoQ, preset and
   revision.
4. **BoQs have a lifecycle and exports are frozen.** Draft, in review, approved, issued. Issued
   BoQs are locked because they go into contracts; changes create a revision.

The BoQ stores a **snapshot** of the presets, not a link, so editing a company preset later
never changes past BoQs. Comparisons come almost free: same model under preset A vs B, or v2 vs
v3 under one preset. Earlier planning also called for a three-tier preset ownership: system
(shipped), org (shared in a company), user/project (custom).

In the dev build these map to: modelId (sha256) = model version; runId = run; presets folder =
presets; decisions sent with each run = decision rows. See 03-architecture.md.

## Several models in one BoQ (federation)

### Why projects are several files

Different firms use different software and cannot author in each other's tools; each discipline
is legally responsible for its own model; disciplines update at different rhythms; large models
reach gigabytes and get split by discipline, building or floor. The norm is a federated model
combined only for viewing or checking (ISO 19650 assumes this). One file happens on small
single-firm projects like the Duplex. **The engine should treat one file as a federation of one.**

### Why merging finished BoQs fails

- Double counting: architect and structural engineer both model the concrete walls.
- Items spanning models: a structural wall gets architectural plaster and paint; formwork comes
  from structure, finishes from architectural rooms.
- Rooms and locations usually exist only in the architectural model.
- Disagreeing models: "Level 1" at 0.00 vs "GF" at +0.05; slightly offset coordinates.

Correct order: (1) load the selected model versions; (2) align coordinates, storey names and
levels; (3) remove duplicates via ownership rules, conflicts to review; (4) link across models
(walls to rooms, openings to hosts); (5) measure once, one BoQ.

Simple merging is correct only where scopes do not overlap (two buildings, two independently
measured phases) with the same preset and classification. That survives as a narrow "combine
BoQs" feature. (This replaces the September "merge action" decision; see D43.)

### Scope rules per model

Users say "take concrete from this model, ignore X; take electrics from that one, ignore bricks".

1. **Tag each model's discipline; defaults follow** (the engine can usually guess:
   `header.disciplineGuess`).

   | Discipline | Provides by default | Ignored by default |
   |---|---|---|
   | Structure | Foundations, load-bearing concrete, steel, reinforcement | Everything else |
   | Architecture | Partitions, finishes, doors, windows, roofs, rooms | Structural elements |
   | MEP | Pipes, ducts, cables, fixtures | Everything else |

2. **Adjust with include/exclude filters** by element type, classification, material or storey
   ("take stairs from architecture; the structural ones are placeholders"; "ignore furniture").
   The type already has `ModelInput.scope: { include?: Selector[]; exclude?: Selector[] }`.
3. **The engine checks the result**: overlaps (claimed by two models, would double count) and
   holes (claimed by none, would go missing), using the same solid-intersection test as the
   Duplex verification, run across files.

Scope settings are saved per project and re-applied to new versions; companies can save templates
("our standard three-discipline split").

**Built (v1, engine `federation.py`, see 05):** steps 1-3 above plus same-GlobalId merging and storey
alignment by elevation. Simplifications: shared coordinates are assumed (a warning when models do not
overlap in space); overlaps are found with bounding boxes, not solids; an element its model does not own
is left to the owning model only when that model has an element of the same IFC class in its place,
otherwise it is kept (a hole avoided, with a warning). Saving scopes per project is the platform's job.

## Users, roles and access

The organisation owns everything; people get roles per project. Nothing leaves when an employee
does. Project membership is the access boundary; the creator is recorded for audit.

| Organisation role | Can |
|---|---|
| Owner / Admin | Manage members, teams, billing; create projects |
| Rules editor | Edit company presets, dictionaries, item libraries |
| Member | Access only projects they are added to |

| Project role | Can |
|---|---|
| Project lead | Manage project members, scope rules, settings |
| Estimator | Upload models, run BoQs, answer questions, add manual items |
| Approver | Approve and issue BoQs |
| Viewer | See and export issued BoQs only |
| Guest (external) | Narrow access, e.g. the structural engineer uploads only structure versions; a client only views issued BoQs |

Teams receive roles as a group ("Estimating team = Estimator on all projects").

Platform-specific rules:

- **Promoting knowledge is a permission.** Any estimator can answer "CT = cement screed" for their
  project; saving it company-wide needs a rules editor.
- **Four-eyes approval** (optional per company): the preparer cannot be the only approver.
- **Issued means locked**, even for admins; changes create a revision.
- **External sharing is narrow and expiring**: read-only links to issued BoQs, or guests limited
  to a model or project.
- **Audit log**: who uploaded, answered, approved and exported what and when; the trail behind
  professional sign-off.

First version: fixed roles, project membership, guests and the audit log. Custom roles and
fine-grained permissions later, on demand.

## Background processing

Every parse and run is a **background job**: users upload, leave and get notified.

1. Upload goes straight to object storage (presigned URL), not through the API.
2. A job is queued; the user sees "Processing started".
3. A worker runs parse, geometry, verification, and the check against the chosen settings.
4. The job ends in a notified state: **Ready** ("Architecture v3 processed, BoQ ready"), **Needs
   input** ("12 questions need your answer"), or **Failed** with a clear reason ("file corrupt",
   "walls have no materials").

```text
queued -> processing (stage 2/5, 40%) -> needs input -> processing -> completed
                                      \-> failed (reason)          \-> cancelled
```

"Needs input" matters: questions mean a job cannot always finish unattended, so it saves state,
notifies and resumes after answers. (Sep 2026 planning named run states parsing ->
pending_review -> calculating -> complete; same idea.) Because parsing is cached per model
version, "resuming" is simply a new fast run with the decisions applied.

Workers are separate processes behind a queue: heavy files never slow the app; workers scale
with load; faster workers can be reserved for enterprise customers; failed jobs retry; users can
cancel. Start with a database job table (`FOR UPDATE SKIP LOCKED`); move to a workflow engine
only if pause/resume grows complex.

### Notifications

In-app live progress over WebSocket or SSE plus a notification bell; email for ready, needs
input and failed (the moments someone must act); team notifications ("BoQ approved", "new
structure version uploaded"); mobile push later.

### Performance

Measured: the Duplex (2.4 MB, about 220 elements) needs about 5 s to parse with geometry and
verification, and under 0.2 s per run afterwards.

Estimates for first processing, assuming an 8-16 core server and optimised code (confirm with
the corpus):

| Model | Typical size | First processing |
|---|---|---|
| Small (house, duplex) | < 1k elements, < 20 MB | 10-30 s |
| Medium (apartment block, office) | 10k-50k elements, 50-300 MB | 1-5 min |
| Large / federated (hospital, airport) | 200k+ elements, GBs | 10-30+ min |

| Step | Cost | Why |
|---|---|---|
| Reading the file | Fast | Simple parsing |
| Generating geometry | Slowest | Every element turned into a solid with openings cut; curved shapes much slower |
| Overlap checks | Slow | Solid comparisons, worse across federated models; needs a spatial index (today O(n²) with a bounding-box test) |
| Room-face relationships | Medium | Which wall face touches which room (not built) |
| AI name resolution | Small | Per unique name, cached (not built) |
| Measuring, rules, output | Milliseconds to seconds | Arithmetic over prepared data |

After the first run: switching preset, classification or grouping takes seconds; answering
questions takes seconds; a new revision should reprocess only changed elements, matched by
GlobalId. That is what makes comparison features feel instant.

## Pricing model (open; numbers untested)

What to charge for: **seats** (predictable for firms), **active projects** (tracks value),
**processing** (large federated models and AI resolution cost real compute: cap by model size or
credits), **rulebook packs** (some standards cost money to license, e.g. CSI).

| Buyer | Usage | Preferred model |
|---|---|---|
| QS firms | Daily | Seat subscription |
| Contractors bidding tenders | Bursts | Pay per project |
| Designers checking costs | Light | Cheap entry tier |

| Tier | For | Includes | Price |
|---|---|---|---|
| Free / Trial | Trying it out | 1 project, small models, "as modelled" only, watermarked export | 0 |
| Pay per project | Occasional bidders | One project for 30-90 days, full features, 1-2 presets | X per project |
| Professional | Small firms | 3-5 seats, about 10 active projects, standard presets, review flow, Excel | Y per month |
| Team | Mid-size firms | More seats and projects, multiple models per project, revisions and comparison, company dictionaries, approval flow | Z per month |
| Enterprise | Large firms | Unlimited, custom presets built with you, SSO, API, audit exports, priority support | Quote |

Add-ons: rulebook packs, extra processing for very large models, API access.

Principles: **regional pricing** (the same tier cannot cost the same in the UK and the Balkans);
**never price per BoQ generated** (it discourages trying presets, and comparison is a key
strength); **pay per project is the entry point**; **custom preset work is service revenue**
(with a QS partner). An earlier (Sep 2026) shape: org seats plus a monthly processing quota,
custom rule creation gated by tier, projects and storage unlimited. Either way, record a
**usage event** for every parse and run from day one, even before charging.

## Wider platform checklist (conventional work)

Accounts, companies and permissions with data separation; big-file handling with queues and
progress; security (encryption, access logs, GDPR in Europe); collaboration (comments,
assignment, prepared / checked / approved flow); sending model problems back to designers via
BCF; project history across revisions; pulling models from common data environments (Autodesk
Construction Cloud, Trimble Connect); pricing with rate databases and tender comparison
(arguably a second product); billing, onboarding, help, interface translations.

## Recommended stack (from the stack discussion; backend now Java)

| Layer | Recommendation |
|---|---|
| Frontend | TypeScript + React; a virtualised grid (AG Grid or TanStack Table) for BoQs and element registers with thousands of rows |
| 3D viewer | That Open Engine (web-ifc + Fragments; MIT/MPL). xeokit is AGPL for free use |
| Backend | **Java** (owner decision); previously suggested Next.js/Node is superseded |
| Engine | Python workers (ifcopenshell, numpy, trimesh + manifold3d, openpyxl) on container hosts sized per job, not serverless |
| Database | Postgres-class: relational core plus JSON columns for rule sets and metadata; 100k+ element rows per model is fine |
| Storage | S3-compatible (AWS S3, Cloudflare R2, Hetzner); presigned uploads |
| Jobs | DB job table first; workflow engine later if needed |
| Realtime | WebSocket or SSE |
| Auth / orgs | Multi-org membership from day one; enterprise SSO later |
| Email | Transactional provider for ready / needs input / failed |
| Shared schema | JSON Schema generated from `packages/types`; Java DTOs generated from it |
| Hosting note | EU hosting (e.g. Hetzner) helps data residency |
