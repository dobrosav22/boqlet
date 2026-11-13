# Engine fakes (phase 1, P39)

One file per fake, `<name>.ts`, behind the `Engine` interface in `../engine.ts`. Every fake is
listed in `plan/06-frontend/mock-api.md` "Engine fakes" with the engine task that replaces it,
and is deleted when that task lands (FE-042 checks the folder holds only this README).

Fakes never measure (BR-01): they only rearrange, relabel or apply values a person entered.

- `line-edits.ts`: "Line edits applied" (EN-003) and "Manual items with codes" (EN-007), FE-011.
- `trace-steps.ts`: "Trace steps" (EN-013), FE-013.
- `export-xlsx.ts`: "BoQ export meta" (EN-006), FE-017.
