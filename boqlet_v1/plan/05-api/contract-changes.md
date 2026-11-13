# Contract changes after phase 1

The contracts (`packages/api/openapi.yaml`, `packages/pricing-api/openapi-pricing.yaml`) were
written in the plan and proven against the mock in phase 1. In phase 2 the backend owner may
change them when the backend needs it (P47, `07-backend/decisions-to-make.md` D18). The owner
runs the final frontend phase and adapts the app (FE-041). This file is how such a change is
made, and the list of every change, so that phase 3 knows what to adapt.

## How a change is made (phase 2)

1. **Decide.** The backend owner decides, and records the reason here. A change to what users
   can do or see is product behaviour: it needs the product owner too.
2. **Make it in one commit, contract first:**
   - edit the contract;
   - `npm run api:lint` and `npm run api:gen`;
   - update the shared suites (`tests/contract`, `tests/scenarios`) so they describe the new
     behaviour. They stay the spec that Java must pass;
   - update the mock's handlers (`apps/mock-api`) for the changed operations, so the app's
     end-to-end tests on the mock stay meaningful;
   - make the **smallest change in `apps/app`** that keeps it compiling and its tests green.
     That means renamed fields and adjusted calls, never a redesign. Mark each spot with
     `// contract-change: <row id>`.
3. **List it below.** Additive changes are listed too (a new optional field the UI could show).
4. CI stays green: lint, typecheck, the app's and the mock's tests, the suites against the mock
   and against Java.

## How phase 3 uses this list

FE-041 goes through every row: it adapts the UI properly where the change affects it, removes
the `contract-change` markers, and sets "Adapted" with its commit. The M8a exit criteria
require every row to be adapted, or marked "nothing to adapt".

## Changes

| Id | Date | Operation(s) | Change | Why | Breaking for the app? | Product owner needed? | Adapted (phase 3) |
|---|---|---|---|---|---|---|---|
| — | | | None yet | | | | |
