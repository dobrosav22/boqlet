# IFC to BoQ

Drop a building model (IFC), choose how to measure and how to code the result, and get a Bill
of Quantities in Excel. Every quantity shows its formula, the values used and the elements behind it.

This is a development build: a React app with a local Python engine. It is the starting point
of the full product monorepo.

## Requirements

- Node.js 20 or newer
- Python 3.10, 3.11, 3.12 or 3.13 on your PATH (`python3`, or `py` on Windows).
  To use a specific one: `IFC_BOQ_PYTHON=/path/to/python npm install`

## Start

```bash
npm install
npm run dev
```

Open http://localhost:5173, drop `fixtures/ifc/Ifc2x3_Duplex_Architecture.ifc` on the left
and press **Generate BoQ**. The defaults ("As modelled" rules, global dictionary, ACME cost
codes) work without any setup.

`npm install` creates a Python virtual environment in `engine/.venv` and installs the engine
(ifcopenshell, trimesh, FastAPI and friends). The first time takes a minute or two. If Python
is missing, npm still installs and prints what to do; run `npm run setup:engine` afterwards.

## What you can do in the app

- **Bill of quantities:** the BoQ grouped by the first ticked classification. Click a line for
  its formula, parameter values, codes and each element's contribution.
- **Calculation log:** everything the engine did, in order. Filter by stage, line or text.
- **Questions:** what the engine could not decide. Answer and regenerate; answers stick for the model.
- **Inputs:** the rule set's parameter values and the raw preset JSON.
- **Compare:** pin a result, change rules or classification, generate again, see both side by side.
- **Download Excel:** BoQ (with rate and amount columns), Calculation, Lines, Log, Questions, Inputs.

Try the demo presets to see how inputs change the output:

| Preset | Kind | What it shows |
|---|---|---|
| Demo: as modelled, two slots changed | Rules | Same rules, two parameter values changed: small openings kept, windows in m2 |
| Demo: small custom rule set | Rules | A complete rule set written from scratch; leaves most of the model unmeasured on purpose |
| Demo: trade sections | Classification | Same quantities, grouped by trade instead of cost codes |

## Other commands

```bash
npm run test                         # typecheck + engine tests
npm run boq -- model.ifc --out boq.xlsx --rules demo-tweaked
npm run import:uniclass              # optional: enable the Uniclass 2015 EF classification
npm run codegen                      # after editing packages/types/src
```

## Documentation

Start with `CLAUDE.md`, then `docs/README.md`.
