# F04 BoQs and runs

## Purpose

A BoQ is built from chosen model versions under chosen presets. Generating it is a background
run. The result is either complete or needs input.

## Stories

- As an estimator, I create a BoQ: name it, pick which models (and versions) go in, the rule
  set, the classifications and the dictionaries. The project's defaults are preselected, and
  I can pick any other preset the org has for this BoQ (P19).
- As an estimator, I press Generate and see progress. In seconds (after the first parse) I see
  the sheet, or a "needs input" state with the questions to answer.
- As an estimator, I change one input (another rule set, an extra code list) and regenerate to
  compare.
- As an estimator, I see when a newer model version exists and swap it in.

## Behaviour

1. **Create BoQ:** name (required), description. Creates the working version (a `draft` revision) with inputs
   prefilled from project defaults and every model's latest `ready` version (each model can be
   unticked). Checks `maxModelsPerBoq`.
   **From a model:** when a model version becomes ready, its page and the notification offer
   "Generate a BoQ": a short dialog with the project's presets preselected and pickers to
   choose others (rule set, classifications) before the first run. Presets are chosen per
   BoQ, never per upload: parsing a model doesn't depend on them.
2. **Setup panel** (revision inputs; editable only in `draft`):
   - **Models:** list of project models with checkbox, version picker (default latest ready),
     discipline (from the model), scope summary with "edit for this BoQ". A "new version
     available" badge appears when a newer ready version exists.
   - **Rule set:** picker over system, org and project rule sets, showing published versions
     (latest by default, "pin to version n" possible). Shows `basedOn` and a short description.
   - **Classifications:** ordered multi-select (first = default grouping). Classifications
     whose code list needs a download (e.g. Uniclass, `available: false`) show the reason.
   - **Dictionaries:** ordered layers: global (system), company (org), project (always last,
     can't be removed).
   - **Federation settings** and **resolution settings:** advanced, default org/system.
3. **Generate** (`POST /revisions/{id}/runs`):
   1. Backend resolves inputs into a **run job input** (`04-architecture/engine-worker.md`):
      flattened preset docs (patches resolved against their exact parent versions), model
      version artifact keys, current project decisions, BoQ overrides and manual items.
   2. Creates `Run(queued)` and a `run` job. Checks `processingMinutesPerMonth`.
   3. Live progress: stages `load`, `names`, `measure`, `federate`, `rules`, `classify`,
      `export`, `index`.
   4. On success, the backend ingests the `BoqResult` into run rows (lines, line-elements,
      questions, warnings, log), sets run status `complete` or `needs_input`, moves
      `revision.currentRunId`, and notifies the requester.
   5. On failure: run `failed`, error message, retry button; previous current run stays shown.
4. **Pending changes indicator:** the revision shows "Inputs changed since this run" when
   inputs, decisions or adjustments differ from those in `currentRun.request` (the backend
   computes `revision.pendingChanges: string[]`, e.g. `["decisions", "inputs.ruleSet"]`).
   Save version (and Submit, with approval on) is disabled while pending changes exist (BR-22).
5. **Run history:** list of runs per revision (time, who, status, line count, flagged count,
   duration), open any old run read-only, compare two (F08).
6. **Archive a BoQ** (lead): hides it from the BoQ list (e.g. an abandoned variant) and makes it
   read-only; restore with `PATCH /boqs/{boqId}` `{archived: false}`. Different from confirming
   (F09 §5, "done") and from archiving the whole project (F02 §7).
7. **Several BoQs per project:** e.g. "Cost check" under one rule set and "Tender BoQ" under
   another, both from the same models and the same project decisions.

## States shown in the BoQ workspace header

| Run status | Header shows |
|---|---|
| none | "Not generated yet" + Generate |
| queued / running | progress bar with stage; Cancel |
| complete | line count, flagged count, last run time, status badge of the revision |
| needs_input | "N questions need an answer before this BoQ is complete" → Questions tab |
| failed | error + Retry; the last good run stays visible underneath |

## Edge cases

- Two users press Generate at the same time on one revision: both runs are created; the
  newest finished becomes current.
- A preset version used by a draft revision gets archived: the next generate still works
  (archived ≠ deleted), with a warning to choose a newer version.
- A model removed from inputs: its decisions stay in the project. Questions that no longer
  occur just don't appear.

## API

`GET /projects/{projectId}/boqs`, `POST /projects/{projectId}/boqs`, `GET /boqs/{boqId}`,
`PATCH /boqs/{boqId}`, `POST /boqs/{boqId}/archive`, `GET /boqs/{boqId}/revisions`,
`GET /revisions/{revisionId}`, `PATCH /revisions/{revisionId}`,
`POST /revisions/{revisionId}/runs`, `GET /revisions/{revisionId}/runs`, `GET /runs/{runId}`,
`GET /runs/{runId}/result`, `GET /orgs/{orgId}/presets`, `GET /jobs/{jobId}`, SSE.

## Acceptance criteria

- [ ] Creating a BoQ in a project with two ready models preselects both latest versions and the project defaults.
- [ ] Generating the Duplex BoQ (cached parse) finishes in under 10 s end to end and shows the sheet without a reload.
- [ ] A run with blocking questions lands in `needs_input`, and the header links to the questions.
- [ ] Changing any input shows "Inputs changed since this run" and disables Save version until regenerated.
- [ ] Two runs with different classifications have identical quantities per line key (BR-02, automated).
