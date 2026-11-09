# 02 Personas and markets

## Two kinds of market, one product

| | Design-led markets | QS-led markets |
|---|---|---|
| Where | Germany, Austria, Switzerland, Central and Eastern Europe, the Balkans, much of the Middle East and Asia | UK, Ireland, Australia, New Zealand, parts of Africa and Asia |
| Who writes the BoQ | The architect or engineering firm, as part of the design and tender documents | An independent quantity surveyor / cost consultant appointed by the client |
| Who owns the model | The same firm | The designers; the QS receives exports |
| Effect on the product | Model problems are fixed fastest by the user in their own authoring tool; versions and carried answers are central | The QS answers questions in the app instead of fixing the model |

**v1 is designed for design-led markets first (P01).** QS firms use exactly the same flows; only
onboarding wording differs. In both, the **tenant is the firm that produces the BoQ**, and
contractors are **vendors** in the optional pricing module. The product's defaults stay international: no country's
standard is the default (D04).

## Personas

### P-A. Design/engineering firm: the tenant

A studio or engineering office of 3–200 people. Uses Revit, Archicad, Tekla, Allplan or a mix.
Produces design documents and, at tender stage, the BoQ for its own projects. Pays per seat.

| Person | Role in the app | Wants | Pain today |
|---|---|---|---|
| **Ana, project lead / architect** | Project lead | Set up the project, see progress, save versions, confirm the BoQ | BoQ is the last bottleneck before tender; numbers she can't check |
| **Marko, BoQ preparer** (engineer, technician or in-house estimator) | Estimator | Upload models, generate the BoQ, answer questions, edit lines, price the BoQ and ask vendors for offers (pricing module) | Days of take-off per revision; finding what changed by hand |
| **Ivana, office standards lead** | Library editor | Encode the office's measuring rules, code lists and name dictionary once, for every project | Every person measures slightly differently; rules live in heads and old spreadsheets |
| **Studio owner** | Org owner | Seats, billing, who sees which project | Paying for tools nobody uses |

### P-B. QS / cost consultant firm: same tenant, different starting point

Same roles as P-A. Differences: receives models from designers instead of authoring them, so
fixes gaps by answering questions; often works to a published standard (NRM-style, client
rulebooks) and to client templates. Uses comparison between presets more.

### P-C. Client / investor: no account

The building owner or their project manager. Has **no account** (P28): the firm sends a public
read-only **share link** (F18) to a BoQ version. Approves nothing in the app in v1 (sign-off
stays with the preparing firm; see 09 for a possible client approval step).

### P-D. Contractor / subcontractor / supplier: vendor (pricing module)

A builder, trade subcontractor or supplier (concrete, masonry, drywall, finishes, MEP). Keeps
a **pricebook** and chooses which price list each linked firm sees (F17, F20). Receives offer
requests from many firms, fills them from the pricebook (remembered matches, manual picks),
adds notes and qualifications, submits. Uses no model and no rules. Pays nothing. **Must be able
to price without friction**, or the firm goes back to sending Excel, so every request also
round-trips through Excel (F11).

## How a project runs (the job the product does)

```text
Design development ──► model versions (v1 … vN) ──► BoQ: working, saved versions (A, B, C) ──► confirmed
                                                      └─(pricing module)─► estimate, offers from vendors
       │                     │                          │
   authoring tool        upload to app             edit lines, save versions (locked),
   (Revit, Archicad…)    parse, questions          optional review/approval, confirm when done
                         answers carried over
```

Typical rhythm: weeks to months of design with a new model version every few days or weeks; the
BoQ is saved as a version at milestones (cost check, permit, tender) and confirmed when done.
The product's part ends there; tendering and construction happen outside it.

## Jobs to be done, by persona

| Persona | Job | Feature |
|---|---|---|
| Estimator | Turn this model into a BoQ in our office's way of measuring | F03, F04, F06 |
| Estimator | Tell the app what our odd material names mean, once | F05, F10 |
| Estimator | See what changed since the last saved version and why | F08 |
| Estimator | Check a suspicious number in seconds | F06, F07 |
| Project lead | Save versions and confirm a BoQ I can defend; switch on approval when the firm wants it | F09 |
| Library editor | Encode our rules and codes so every project uses them | F10 |

| Vendor (pricing module) | Keep my prices in a pricebook; answer offer requests from it in minutes | F17, F20, F11 |
| Estimator (pricing module) | Price the BoQ from our pricebook and vendors' lists; compare vendor offers | F20, F11 |
| Owner | Manage seats, plan, usage | F01, F14 |
