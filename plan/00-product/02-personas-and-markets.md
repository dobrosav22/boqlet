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
contractors are invited bidders. The product's defaults stay international: no country's
standard is the default (D04).

## Personas

### P-A. Design/engineering firm: the tenant

A studio or engineering office of 3–200 people. Uses Revit, Archicad, Tekla, Allplan or a mix.
Produces design documents and, at tender stage, the BoQ for its own projects. Pays per seat.

| Person | Role in the app | Wants | Pain today |
|---|---|---|---|
| **Ana, project lead / architect** | Project lead | Set up the project, see progress, approve and issue | BoQ is the last bottleneck before tender; numbers she can't check |
| **Marko, BoQ preparer** (engineer, technician or in-house estimator) | Estimator | Upload models, generate the BoQ, answer questions, fix lines, prepare tenders | Days of take-off per revision; finding what changed by hand |
| **Ivana, office standards lead** | Library editor | Encode the office's measuring rules, code lists and name dictionary once, for every project | Every person measures slightly differently; rules live in heads and old spreadsheets |
| **Studio owner** | Org owner | Seats, billing, who sees which project | Paying for tools nobody uses |

### P-B. QS / cost consultant firm: same tenant, different starting point

Same roles as P-A. Differences: receives models from designers instead of authoring them, so
fixes gaps by answering questions; often works to a published standard (NRM-style, client
rulebooks) and to client templates. Uses comparison between presets more.

### P-C. Client / investor: guest

The building owner or their project manager. Invited as a **guest** to one project. Sees issued
BoQ revisions and tender comparisons when shared. Approves nothing in the app in v1 (sign-off
stays with the preparing firm; see 09 for a possible client approval step).

### P-D. Contractor / subcontractor: bidder

A builder or trade subcontractor (concrete, masonry, drywall, finishes, MEP). Receives tender
invitations from many firms. Enters rates per line, adds notes and qualifications, submits
before the deadline. Uses no model and no rules. Pays nothing. **Must be able to price without
friction**, or the firm goes back to sending Excel. So there is an Excel download/upload
round-trip for the package (F11).

## How a project runs (the job the product does)

```text
Design development ──► model versions (v1 … vN) ──► BoQ revisions (A, B, C) ──► tender ──► award
       │                     │                          │                       │
   authoring tool        upload to app             review, approve,        packages to
   (Revit, Archicad…)    parse, questions          issue (locked)          contractors, offers,
                         answers carried over                              comparison
```

Typical rhythm: weeks to months of design with a new model version every few days or weeks; the
BoQ is produced at fixed milestones (cost check, permit, tender); a tender lasts 2–6 weeks, with
addenda when the design changes during it.

## Jobs to be done, by persona

| Persona | Job | Feature |
|---|---|---|
| Estimator | Turn this model into a BoQ in our office's way of measuring | F03, F04, F06 |
| Estimator | Tell the app what our odd material names mean, once | F05, F10 |
| Estimator | See what changed since the last issue and why | F08 |
| Estimator | Check a suspicious number in seconds | F06, F07 |
| Project lead | Approve and issue a BoQ I can defend | F09 |
| Library editor | Encode our rules and codes so every project uses them | F10 |
| Estimator / lead | Send packages to contractors and compare offers | F11 |
| Bidder | Price a package quickly, in the browser or in Excel | F11 |
| Owner | Manage seats, plan, usage | F01, F14 |
