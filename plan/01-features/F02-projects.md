# F02 Projects

## Purpose

A project is one building or job. It holds the models, BoQs, decisions and tenders, and decides
who works on it.

## Stories

- As a member, I create a project with a name, optional code and client, and pick its
  currency, unit system and default presets.
- As a project lead, I add colleagues with project roles and invite external guests (e.g. the
  client) who see only issued revisions.
- As a member, I see a dashboard of my projects with what needs attention (questions waiting,
  reviews requested, tenders closing).
- As a lead, I archive a finished project. It becomes read-only and stops counting as active.

## Behaviour

1. **Create:** checks `activeProjects` (`402`). Fields: name (required), code, client, country,
   address, currency (default org), unit system (default org), locale (default org). The creator
   becomes `lead`.
2. **Default presets:** rule set version, classification versions (zero or more, ordered:
   the first is the default grouping), dictionary versions (ordered, most general first).
   Defaults prefill new BoQs. Initial defaults: the org's starred presets, else the system
   "As modelled" rule set, the global seed dictionary and no classification.
3. **Project dictionary:** created automatically (an empty project-layer dictionary preset)
   and always applied as the most specific layer. Edited in the project's Library tab (F10).
4. **Members:** add org members by picking them (`lead`, `estimator`, `approver`, `viewer`).
   Add guests by email (role `guest`). A guest invitation creates a pending `ProjectMember` and
   an email. Guests don't use seats.
5. **Dashboard** (`/{org}`): project cards with name, code, status, last activity, and counts:
   blocking questions, revisions in review, open tenders with deadlines. A "Needs you" list
   aggregates: reviews assigned to me, runs of mine that need input, tenders closing in 3 days,
   failed jobs.
6. **Project overview** (`/{org}/projects/{id}`): models with latest version and status, BoQs
   with current revision label and status, open tenders, recent activity (from the audit log).
7. **Archive:** allowed when no tender is `open`. Archived projects are read-only (all writes →
   `409 project_archived`) and can be restored if `activeProjects` allows.

## Screens

- `/{org}` dashboard; `/{org}/projects/new`; `/{org}/projects/{projectId}` overview;
  `/{org}/projects/{projectId}/settings` (general, defaults, members & guests, danger zone).

## Edge cases

- A default preset version is archived in the Library. The project setting shows a warning
  and new BoQs need another choice.
- Unit system change after BoQs exist: affects future runs only. Existing runs keep their
  units, and the next run of each revision shows the converted values.

## API

`GET /orgs/{orgId}/projects`, `POST /orgs/{orgId}/projects`, `GET /projects/{projectId}`,
`PATCH /projects/{projectId}`, `POST /projects/{projectId}/archive`,
`POST /projects/{projectId}/unarchive`, `GET /projects/{projectId}/members`,
`POST /projects/{projectId}/members`, `PATCH /projects/{projectId}/members/{userId}`,
`DELETE /projects/{projectId}/members/{userId}`, `GET /projects/{projectId}/audit`,
`GET /orgs/{orgId}/attention` (the "Needs you" list).

## Acceptance criteria

- [ ] Creating a project beyond `activeProjects` returns `402`; archiving one frees the slot.
- [ ] A member without a project role doesn't see the project in lists and gets `404` on direct access.
- [ ] A guest sees only issued revisions and nothing in models, questions or drafts.
- [ ] An archived project rejects writes with `409 project_archived` and shows a read-only banner.
- [ ] The dashboard's "Needs you" list shows a review request within 5 seconds of submission (live update).
