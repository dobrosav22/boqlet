# Sessions: how an agent works through the build

The build is done by coding-agent sessions (P38, P45). A session can end at any point: its
context fills up, the owner stops it, the machine restarts. The next session, possibly another
agent, must be able to pick up **without asking anyone**. This file says how a session starts,
works, decides, stops and hands over.

"Frontend agent" and "backend agent" are **roles**, not particular agents. A session takes the
role of the current phase: phase 1 and phase 3 are the frontend role, phase 2 is the backend
role (`milestones.md`). `10-build-log.md` "Current position" says which phase it is.

## The prompt (any session, any phase)

The owner starts every session with this prompt, unchanged:

```text
You are building boqlet in this repository, and the owner has said go.
Read CLAUDE.md at the repository root and follow it to the plan's "Start here",
plan/08-delivery/sessions.md and plan/10-build-log.md "Current position".
Continue the build from the current position, in the role of the current phase:
take the next task, build it, test it, commit and push to main, record it, and go
on to the next one. Work on your own; stop only where sessions.md says to stop.
```

The owner may add one line:
- `Stop at the end of each milestone and wait for me.` (to review between milestones)
- `Only do <task id>.` (one task)
- An answer to a question the previous session asked (`Qnn: yes, as recommended.`)

`CLAUDE.md` at the repository root always points to the right place. Until FE-000 that is
`plan/`; from FE-000 the plan lives in `boqlet_v1/plan/` and the root `CLAUDE.md` is a pointer
to `boqlet_v1/CLAUDE.md`; after FE-046 it is `plan/` at the repository root again (P44).

## Starting a session

1. `git pull`. Then `git status`:
   - clean: go on;
   - not clean: read "In progress" in the build log's Current position. If it explains the
     changes, continue from them. If it doesn't, `git stash push -m "unexplained changes found
     by <date> session"`, note the stash in Current position, and go on from the last commit.
2. Read `CLAUDE.md`, `plan/README.md` "Start here", this file, the build log's Current position
   and the newest entry, then the task file of the current phase and the specs the next task
   names.
3. Set up what's missing (see "Tooling"): `npm install` in the product root (also creates the
   engine's Python venv), Playwright's Chromium, Docker in phase 2.
4. Run the baseline before changing anything: `npm run test`, plus the contract and scenario
   suites and the Playwright smoke once they exist. If something is red, making it green is the
   first job; write in the build log what was red and why.

## Working

- **One task at a time, in order** (the task file and `milestones.md`). Build what the task and
  its specs say, nothing more. A task is done when its acceptance criteria hold and the
  definition of done in `testing.md` is met.
- **Commit small, straight to `main`** (P40). Every commit message starts with the task id
  (`FE-009: group-by switch`). Never commit red: build, typecheck and the affected tests pass
  before each commit. Push at least after every task.
- **After every task:** a row in `docs/11-roadmap-and-open-questions.md` "Done" (with the commit
  hash, project rule), "Known limitations" there if the task leaves one, and "Current position"
  in the build log.
- **At the end of a milestone:** check each exit criterion in `milestones.md` and say how it was
  checked, write the milestone entry in the build log, update the status table in
  `plan/README.md`, then go on with the next milestone.
- **At the end of a phase:** write the phase summary in the build log, set Current position to
  the next phase's first task and role, push, and stop (the owner starts the next phase with
  the same prompt).

## Yours to decide, or the owner's

| Decide yourself, and write it in the build log | Ask the owner (add it to `09-open-questions.md` first) |
|---|---|
| Libraries and versions inside the stack the plan fixes (pin them; record in the matching architecture file) | Product behaviour a spec doesn't define, or where two specs contradict each other |
| File and folder layout inside a package; internal interfaces; naming of internal things | Anything that changes a P-decision or a BR rule |
| Test structure, fixtures, helpers | A contract change that changes behaviour (fixing a contract that contradicts its spec is yours: change `openapi*.yaml` first, lint, log it) |
| Small UI details the design guidelines and screens already imply | A visual decision the design guidelines don't cover (`design-guidelines.md`) |
| The order of steps inside a task | Anything needing an account, a secret or money (auth provider, hosting, email, billing) |
| Fixing a bug found in earlier work (with a test, noted in docs/11) | Deleting or rewriting something outside the task's scope |

When a question blocks a task: add it to `09-open-questions.md` (with "Blocks: <task>"), ask the
owner in the session, and **go on with the next task that doesn't depend on it**. Note the
skipped task under "Waiting for the owner" in Current position and come back when it's answered.

## When to stop

Stop and wait for the owner only when:
1. an owner decision is needed and no other task of the phase can go ahead (for example BE-000,
   FE-043 before D1, BE-032 and FE-047 without hosting accounts);
2. the phase is done;
3. the baseline is red for a reason outside your role and you can't fix it within it;
4. the next step is destructive or can't be undone outside the task's scope (rewriting
   history, force-pushing, deleting data or accounts, publishing, spending money);
5. the owner asked to stop at milestones.

Before stopping: everything green is committed and pushed, and Current position says why you
stopped and what you need.

## Ending a session (or when the context is nearly full)

- Commit and push everything that is green.
- Half-done work that is not green yet: leave it in the working tree and describe it under
  "In progress" in Current position (the files, what is done, what is left, how to check it).
  Prefer small green commits, so this is rare.
- Update Current position: last task done, next task, waiting for the owner, notes.

## Tooling

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22 LTS (20 works) | **npm workspaces** in the product root (`apps/*`, `packages/*`); no pnpm or yarn |
| Python | 3.10–3.13 | the engine's venv in `engine/.venv`, created by `npm install` (`npm run setup:engine` recreates it) |
| Java | 21 | Spring Boot 3 with Gradle (Kotlin DSL) unless BE-000 (D2) decides otherwise |
| Docker | recent | phase 2: Postgres and MinIO for Testcontainers and local runs |
| Playwright | pinned in `apps/app` | `npx playwright install chromium` |
| Operating systems | Windows 11 (the owner's machine, PowerShell), Linux in CI | scripts in Node or Python, never bash-only; paths built with `path.join` |
| CI | GitHub Actions | `.github/workflows/` at the repository root; until FE-046 the product jobs run with `working-directory: boqlet_v1` |

## Local ports

Defaults; each can be changed by environment variable.

| Port | Service | Until |
|---|---|---|
| 3000 | Next.js app (`apps/app`) | — |
| 4010 | Mock API (`apps/mock-api`) | — |
| 8787 | Proof-of-concept engine API (`engine/ifc_boq/api.py`, `IFC_BOQ_ENGINE_PORT`) | FE-046 |
| 8788 | Engine worker HTTP transport (`ENGINE_URL`, EN-001) | — |
| 8080 | Java API (`services/api`) | — |
| 5432 | Postgres | — |
| 9000, 9001 | MinIO (S3 API, console) | — |
| 5173 | Proof-of-concept web UI (`apps/web`) | FE-046 |

## Where things are written down

| What | Where |
|---|---|
| A task is done | `docs/11-roadmap-and-open-questions.md` "Done" (with the commit hash) |
| Where the build stands, what's next, half-done work | `plan/10-build-log.md` "Current position" |
| Milestone summaries, implementation decisions, deviations, known issues | `plan/10-build-log.md` entries |
| A product decision (the owner's) | `plan/README.md` decisions table (next P-number); platform ones also in `docs/02-decisions.md` |
| An open question | `plan/09-open-questions.md` |
| Engine fakes in the mock (phase 1) | `plan/06-frontend/mock-api.md` "Engine fakes" |
| What the product can't do yet | `docs/11` "Known limitations" |
| Milestone state | `plan/README.md` status table |
