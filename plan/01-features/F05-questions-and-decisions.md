# F05 Questions and decisions

## Purpose

The engine asks when it cannot decide: an unknown material name, a missing value, an element
no rule measures, a contradiction in the file, two models claiming the same element. Answers
are stored once per project and applied to every run, every BoQ and every new model version.

## Question kinds (engine `QuestionKind`) and their answer controls

| Kind | Example message | Answer control (`AnswerType`) | Blocking |
|---|---|---|---|
| `unknown_name` | Material "BETON C25" (14 elements) is not in any dictionary | term picker (search the term hierarchy, with category) + "add to project dictionary" | if a rule needs the field |
| `missing_data` | Door D-12 has no width; rule "doors by area" needs it | number (with unit) or choice "flag the line" | rule's `onMissing: ask` |
| `unmatched` | 23 IfcFurniture "Chair-Desk" are not measured by any rule | rule picker or "exclude" | no (informative) |
| `double_claim` | Two rules measure the same slab for "area" | choice of rule | yes |
| `unclassified` | Line "Skirting, timber" has no code in "ACME cost codes" | code picker from that code list | if the map says `ask` |
| `classification_conflict` | Two map rules give different codes | code picker | no |
| `contradiction` | Wall W-3 reports 12.1 m³; geometry gives 9.8 m³ | choice (reported / geometry), recommended marked | no |
| `overlap` | Wall W-3 (Architecture) and W-77 (Structure) overlap 96% | choice (keep A / keep B / keep both) | yes |
| `orphan_override` (new, EN-003) | Your override on line "…" no longer matches a line | choice (remove override / keep for later) | no |

## Stories

- As an estimator, I see questions grouped by kind, blocking first, with element counts.
- I answer one question, or many at once (select ten unknown names → same term).
- I click a question to see its elements in the viewer and their properties.
- I dismiss an informative question ("leave it"), and it stops showing.
- As a library editor, I promote a name answer to the company dictionary so all future
  projects resolve it.
- As an estimator, I review all project decisions in one table, change or clear any of them,
  and see who decided what and when.

## Behaviour

1. **Questions tab** (BoQ workspace) lists `GET /runs/{runId}/questions` joined with project
   decisions: unanswered first, blocking first, then by kind, then by occurrences. Filter by
   kind, model, answered/unanswered. Answered rows show the answer and "changed in this run's
   inputs" if they were answered after the run.
2. **Answering** writes a project decision: `POST /projects/{projectId}/decisions`
   `{decisions: [{questionId, kind, answer, note?}]}` (one or many). With `?dryRun=true` the
   response lists revisions that would go back to draft (BR-23). The UI shows that warning
   only when the list is non-empty.
3. **Not auto-regenerated.** After answering, the header shows "N answers not applied yet –
   Regenerate". Regenerate is one click and fast. (Auto-regenerate after a pause of inactivity
   can be added later behind a user setting.)
4. **Suggestion:** if the question carries `suggestion`, it is preselected and marked
   "suggested".
5. **Name answers** (`unknown_name`): the picked term becomes a decision. "Also add to the
   project dictionary" (default on) writes an entry to the project dictionary preset (new
   draft auto-published, project layer). The decision stays as the record.
6. **Promote** (library editor): `POST /decisions/{decisionId}/promote {dictionaryPresetId}`
   publishes a new version of the chosen org dictionary with the entry added. It is audited.
   Projects pick it up when they use the latest version.
7. **Decisions page** (`/{org}/projects/{p}/decisions`): table of every decision: kind,
   question summary (raw text / element / line), answer, decided by/at, note, used in latest
   runs (yes/no). Edit and clear. Export CSV.
8. **Carry-over:** because question ids are deterministic (`name:{field}:{raw}`,
   `missing:{rule}:{guid}`, `unmatched:{class}:{type}`, `unclassified:{system}:{lineKey}`,
   `overlap:…`), answers apply automatically to new model versions and other BoQs (BR-04,
   BR-05). A decision whose question no longer appears is kept and marked "not used by
   current runs".
9. **Viewer link:** each question with `guids` has "Show in 3D", which opens the viewer with
   those elements isolated and their properties in the side panel.

## Edge cases

- One raw name appears in two models: one question, one decision (ids contain no model).
- A decision answered with a term that is later removed from the dictionary: the engine
  raises the name question again, and the decisions page marks the old decision "term no
  longer exists".
- Bulk answer across mixed kinds is not allowed: the selection is limited to one kind and one
  answer type.

## API

`GET /runs/{runId}/questions`, `GET /projects/{projectId}/decisions`,
`POST /projects/{projectId}/decisions` (`?dryRun=true`), `DELETE /decisions/{decisionId}`,
`POST /decisions/{decisionId}/promote`, `GET /orgs/{orgId}/terms`,
`GET /runs/{runId}/elements/{guid}`.

## Acceptance criteria

- [ ] Answering all blocking questions of a `needs_input` run and regenerating gives a `complete` run.
- [ ] Uploading a new model version with the same names asks nothing again (automated with the Duplex and a renamed copy).
- [ ] Bulk-answering 10 unknown names is one request and one regenerate.
- [ ] Changing a decision that an `approved` revision's run used warns first and, if confirmed, moves the revision to `draft`.
- [ ] A promoted answer appears in a new org dictionary version, and a new project using that version doesn't get the question.
