# F10 Library: rule sets, classifications, dictionaries

## Purpose

The firm's own measuring knowledge, as data it owns: how to measure (rule sets), how to code
and group (classifications), what names mean (dictionaries). Versioned, previewable, shared by
every project. This is the product's main differentiator (docs/02 D11–D17, D23).

The PoC Library (`apps/web/src/library/*`, guides in `docs/14`, `docs/15`, `docs/16`) already
has the editors in plain language. **Port them**; this spec adds what the product needs
around them: layers, versions, permissions, preview against a project model.

## Concepts

| | Rule set | Classification | Dictionary |
|---|---|---|---|
| Engine doc | `RuleSet` or `RuleSetPatch` (rules.ts) | `{codeList: CodeList, map: ClassificationMap}` (classification.ts) | `Dictionary` (dictionary.ts) |
| Changes numbers | yes | never (BR-02) | indirectly (rules match on terms) |
| Typical start | Copy of system "As modelled" as a patch | Import a code list from Excel/CSV, then map items | Names from a model (Names tab) |
| Layers | system / org / project | system / org / project | system (global) / org (company) / project |

Also editable as advanced documents: **federation settings** (discipline ownership) and
**resolution settings**.

## Behaviour

1. **Library home** (`/{org}/library`): tabs per kind; table of presets: name, layer badge,
   based on, latest version, draft exists, last edited by/at, used by N BoQs. System presets
   are listed read-only, with "Make a copy". Filter by layer. Project-layer presets are listed
   in the project's own Library tab (`/{org}/projects/{p}/library`).
2. **Create:** kind + name + start from (empty / copy of an existing version / patch on a rule
   set version / import code list). Checks `libraryOrgPresets` (402). Creates a preset with
   a draft version.
3. **Edit draft:** the PoC editors:
   - rule set: Settings (slot questions by section), BoQ items (item sentences, forms), Advanced
     (questions setup, JSON); readable formulas;
   - classification: Codes per line (table), Code list (with "About this list", import),
     Advanced (map rules, JSON);
   - dictionary: Names in the model, Names it explains, Meanings, Advanced.
   Drafts **autosave** (`PUT /presets/{id}/draft`, debounced 1 s; ETag to detect a parallel
   edit, `409 draft_conflict` → reload or overwrite dialog). Every save runs the engine check
   (`POST /presets/check` inside the backend) and returns `problems[]`, shown inline.
4. **Publish:** only with zero problems; change note required → immutable version n+1.
   Projects pinned to a version stay pinned; "latest" pickers move to the new one for new
   revisions only (BR-07).
5. **Versions:** history list (number, note, by, at), view any version read-only, diff two
   versions as JSON diff (structured diff later), "restore as draft".
6. **Preview** (rule sets, classifications, dictionaries): pick a project and model
   version(s) the user can access → `POST /presets/{presetId}/preview {draft: true | versionId, modelVersionIds[], otherInputs?}`
   → `preview` job → BoQ lines + questions shown in a compact sheet beside the editor, and
   "what changed vs the published version" (diff of the two previews, EN-005). No run is
   stored and no usage of BoQ data is changed. Preview counts as processing (usage event).
7. **Names in a model** (dictionary editor): pick a model version → `POST /model-versions/{id}/names`
   with the draft dictionary layers → table of raw names, counts, resolved term, method,
   "worth asking". Assign terms inline (adds entries to the draft).
8. **Code-list import** (classification editor): upload xlsx/csv →
   `POST /codelists/read` (sheets, rows, column guess) → map columns → `POST /codelists/build`
   → codes + problems + stats → into the draft. (PoC `CodeImport.tsx`.)
9. **Where used:** `GET /presets/{presetId}/usage` → BoQ revisions (project, BoQ, revision,
   status, version used). Rename of ids across documents works as in the PoC (docs/11
   "Renaming across documents") within the org.
10. **Archive:** hides from pickers. Runs and issued revisions keep their snapshots.
11. **Permissions:** org presets: library editors and admins edit; members view and pick.
    Project presets: project lead and estimators edit.
12. **Licensing guardrails** (BR-53): no upload of standards documents for extraction; the
    "based on" field is free text; UI copy never says "compliant". A one-time notice on first
    rule-set creation explains "bring your own licence" (D30–D31).

## Edge cases

- A patch whose parent version is archived: still flattens (archived ≠ deleted). The editor
  offers "rebase on latest", showing the parent changes.
- Two editors on one draft: optimistic concurrency via ETag (see above). No real-time
  co-editing in v1.
- Very large code lists (Uniclass): stored in object storage, edited with paged tables.

## API

`GET /orgs/{orgId}/presets`, `POST /orgs/{orgId}/presets`, `GET /presets/{presetId}`,
`PATCH /presets/{presetId}`, `POST /presets/{presetId}/archive`,
`GET /presets/{presetId}/versions`, `GET /preset-versions/{versionId}`,
`PUT /presets/{presetId}/draft`, `DELETE /presets/{presetId}/draft`,
`POST /presets/{presetId}/publish`, `POST /presets/check`, `POST /presets/{presetId}/preview`,
`GET /presets/{presetId}/usage`, `GET /orgs/{orgId}/terms`, `POST /model-versions/{versionId}/names`,
`POST /codelists/read`, `POST /codelists/build`.

## Acceptance criteria

- [ ] A library editor copies "As modelled" as a patch, changes three Settings, previews on the Duplex and sees the changed lines next to the editor.
- [ ] Publishing with problems is impossible. Publishing creates version n+1, and older versions are read-only.
- [ ] A BoQ issued with version 1 still shows version-1 numbers after version 2 is published.
- [ ] Importing an xlsx code list with 3 levels builds the hierarchy and reports duplicates.
- [ ] A member without library rights can view and pick org presets but sees no edit actions, and the API returns `403` on edits.
