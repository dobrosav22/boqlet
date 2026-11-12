# Engine fakes (phase 1, P39)

One file per fake, `<name>.ts`, behind the `Engine` interface in `../engine.ts`. Every fake is
listed in `plan/06-frontend/mock-api.md` "Engine fakes" with the engine task that replaces it,
and is deleted when that task lands (FE-042 checks the folder holds only this README).

Fakes never measure (BR-01): they only rearrange, relabel or apply values a person entered.

None yet: the first ones arrive with the tasks that need them (FE-011 line edits, FE-021 preview, …).
