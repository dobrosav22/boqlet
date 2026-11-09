# F02 Projects

## Purpose

A project is one building or job. It holds the models, BoQs and decisions, and decides
who works on it.

## Stories

- As a member, I create a project with a name, optional code and client, and pick its
  currency, unit system and default presets.
- As a project lead, I add colleagues with project roles. People outside the firm get share
  links (F18), not accounts (P28).
- As a member, I see a dashboard of my projects with what needs attention (questions waiting,
  reviews requested, BoQs with new model versions).
- As a lead, I archive a finished project. It becomes read-only and stops counting as active.

## Behaviour

1. **Create:** checks `activeProjects` (`402`). Fields: name (required), code, client, country,
   address, currency (default org), unit system (default org), locale (default org). The creator
   becomes `lead`.
2. **Default presets:** rule set version, classification versions (zero or more, ordered:
   the first is the default grouping), dictionary versions (ordered, most general first).
   Defaults prefill new BoQs. Initial defaults: the org's starred presets, else the system
   "As modelled" rule set, the global seed dictionary and no classification. After the setup
   wizard (F16) the org's starred presets are the ones it published. Defaults only prefill:
   every BoQ can use other presets (F04 §1–2, P19).
3. **Project dictionary:** created automatically (an empty project-layer dictionary preset)
   and always applied as the most specific layer. Edited in the project's Library tab (F10).
4. **Members:** add org members by picking them (`lead`, `estimator`, `approver`, `viewer`).
   Only org members can be project members (P28).
5. **Dashboard** (`/{org}`): project cards with name, code, status, last activity, and counts:
   blocking questions, versions in review, BoQs confirmed / working. A "Needs you" list
   aggregates: reviews assigned to me, runs of mine that need input, new model versions for my BoQs,
   failed jobs.
6. **Project overview** (`/{org}/projects/{id}`): models with latest version and status, BoQs
   with status (working, with the last saved version's label, or confirmed), recent activity
   (from the audit log). Modules may add cards (extension point `project.overviewCards`).
7. **Archive:** always allowed (modules are told through the `project.archived` event). Archived projects are read-only (all writes →
   `409 project_archived`) and can be restored if `activeProjects` allows.

## Screens

- `/{org}` dashboard; `/{org}/projects/new`; `/{org}/projects/{projectId}` overview;
  `/{org}/projects/{projectId}/settings` (general, defaults, members, danger zone).

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
- [ ] Adding a project member accepts org members only; an email of someone outside the org is refused with a hint to use a share link.
- [ ] An archived project rejects writes with `409 project_archived` and shows a read-only banner.
- [ ] The dashboard's "Needs you" list shows a review request within 5 seconds of submission (live update).
