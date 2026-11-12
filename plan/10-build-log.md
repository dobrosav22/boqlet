# Build log

The memory of the build, kept by the agents that build it (P45). The specs say what to build.
This log says **where the build stands** and **what the agents decided along the way** that a
later agent needs to know and can't see in the specs. How sessions use it: `08-delivery/sessions.md`.

- **Current position** is rewritten by every session: after every task, and before the
  session ends or stops.
- **Entries** are added, newest first:
  - at the end of every milestone and phase;
  - when a session takes an implementation decision a later agent must know;
  - when it deviates from a spec.

  Entries are never rewritten; a later entry corrects an earlier one.

Not here: finished tasks one by one (`docs/11` "Done"), product decisions (the owner's,
`plan/README.md`), open questions (`09-open-questions.md`).

## Current position

| | |
|---|---|
| Phase | Not started (waiting for the owner's go) |
| Role | Frontend agent (phase 1) |
| Last task done | — |
| Next task | FE-000 Consolidate the repository into the product root (M0) |
| Waiting for the owner | — |
| In progress (not committed) | — |
| Notes for the next session | — |

## Entry template

```markdown
### <YYYY-MM-DD> — <milestone or phase> (<role>)
- **Built:** task ids, first..last commit.
- **Exit criteria:** each one and how it was checked; criteria passed only on a fake marked "(fake)".
- **Decisions taken:** what was decided, why, and the file that shows it (libraries and versions,
  layout, internal interfaces).
- **Deviations from the spec:** what differs, why, and the spec that was changed or the question
  opened (Qnn).
- **Fakes:** rows added to or removed from `06-frontend/mock-api.md`.
- **Known issues and debt:** each with the task that should deal with it.
- **For the next agent:** anything that isn't obvious from the code and the specs.
```

## Entries

None yet.
