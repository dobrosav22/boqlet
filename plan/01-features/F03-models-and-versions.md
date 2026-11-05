# F03 Models and versions

## Purpose

Bring IFC files into a project as versions of discipline models, process them in the
background, and show what is in them and what is wrong with them before any BoQ is made.

## Stories

- As an estimator, I add a model ("Architecture"), choose its discipline, and upload an IFC.
  I see upload and processing progress and can leave the page.
- As an estimator, I upload v2 of the Architecture model. BoQs using v1 show "new version
  available".
- As an estimator, I read the input-check report: schema, authoring tool, storeys, element
  counts by class, problems (no material, no geometry, volume mismatches, overlaps), each with
  the elements involved, which I can click to see them in 3D.
- As an estimator, I set scope rules per model ("exclude furniture from this model").

## Behaviour

1. **Create model:** name, discipline (`architecture`, `structure`, `mep` + any discipline key
   in the org's federation settings), optional scope. The discipline is suggested from the first
   version's `disciplineGuess` if the user leaves it as "detect".
2. **Upload a version** (direct to storage, see `04-architecture/storage-jobs-realtime.md`):
   1. Client validates: extension `.ifc` (`.ifczip` later), size ≤ `maxModelVersionMb`.
   2. `POST /models/{id}/versions {fileName, sizeBytes, sha256?, note?}` → `{version, upload: {url, method, headers}}`.
      Checks entitlements (`402 limit_reached`, `maxModelVersionMb`, `processingMinutesPerMonth`).
   3. Client PUTs the file to `upload.url` with progress (resumable/multipart for > 100 MB).
   4. `POST /model-versions/{id}/complete` → backend verifies the object exists, checks the
      header starts with `ISO-10303-21`, computes sha256 if missing, then either reuses an
      identical parse (same sha256 in org → straight to `ready`) or enqueues a `parse` job.
   5. Live progress through SSE (`job.progress`): stages `download`, `read`, `geometry`,
      `verify`, `write`, with pct.
3. **Parse job output** (engine `parse_file`): `ModelSummary`, verification checks, artifacts
   (`parsed.json`, `geometry.glb`, `meshes.npz`, `scene.json`). Version → `ready`, model
   `latestVersionId` updated, notification `model_version.ready` to the uploader, and
   `boq.new_version_available` to project members working on BoQs that use an older version
   of this model.
4. **Failure:** version → `failed` with a code and a human message
   (`not_ifc`: "This file is not an IFC file"; `unsupported_schema`; `corrupt_file`;
   `parse_timeout`). Retry is offered for retryable errors.
5. **Input-check report** (model version page):
   - header: file name, size, schema, authoring app, uploaded by/at, note, parse time;
   - storeys (name, elevation);
   - counts by IFC class (table, sortable), openings, spaces;
   - **checks** grouped by `CheckCode` with counts, severity and affected GlobalIds; each row
     opens the viewer with those elements isolated;
   - **names preview:** distinct material/type names and whether the selected dictionaries
     resolve them (engine `names` call, `POST /model-versions/{id}/names`), so the user sees
     upcoming name questions before generating.
6. **Version list per model:** number, date, uploader, note, status, element count, and
   "used by" (BoQ revisions referencing it). Compare two versions' summaries side by side
   (counts by class delta). The element-level diff comes from runs (F08).
7. **Scope rules** (model settings): include/exclude selectors built with the same selector UI
   as the Library (F10): IFC class, family, dictionary term, property, storey. Copied into new
   BoQ revisions. Changing it on the model doesn't change existing revisions.
8. **Delete version:** only if no run references it. Otherwise "archived" (hidden from pickers).

## Screens

- `/{org}/projects/{p}/models` (list of models with latest version status, upload dropzone per model)
- `/{org}/projects/{p}/models/{m}` (versions table, settings: name, discipline, scope)
- `/{org}/projects/{p}/models/{m}/versions/{v}` (input-check report, viewer tab)

## Edge cases

- Same file uploaded twice to the same model: allowed, a new version number with "identical to
  v3" shown. No re-parse.
- Upload interrupted: the version stays `awaiting_upload`. Resume is offered on the same
  device. Abandoned versions are cleaned up after 24 h.
- A huge model (> 300 MB) on Enterprise: allowed, routed to the large worker pool (NFR).
- Models in different coordinate systems: v1 assumes shared coordinates. The run warns (BR-32).

## API

`GET /projects/{projectId}/models`, `POST /projects/{projectId}/models`, `GET /models/{modelId}`,
`PATCH /models/{modelId}`, `DELETE /models/{modelId}`, `GET /models/{modelId}/versions`,
`POST /models/{modelId}/versions`, `GET /model-versions/{versionId}`,
`DELETE /model-versions/{versionId}`, `POST /model-versions/{versionId}/complete`,
`POST /model-versions/{versionId}/retry`, `GET /model-versions/{versionId}/geometry`,
`GET /model-versions/{versionId}/scene`, `POST /model-versions/{versionId}/names`,
`GET /jobs/{jobId}`, `POST /jobs/{jobId}/cancel`, SSE `GET /events`.

## Acceptance criteria

- [ ] Uploading the Duplex shows upload progress, then processing stages, then the report, with no page reload.
- [ ] Leaving and coming back during processing shows the live state. A notification arrives when it is ready.
- [ ] A non-IFC file fails with `not_ifc` and a readable message, and no job is retried.
- [ ] Uploading identical content twice in an org parses once (one parse job, two versions).
- [ ] Every check row opens the viewer with exactly the affected elements highlighted.
- [ ] Over `maxModelVersionMb` is rejected before upload starts (client) and at version creation (server).
