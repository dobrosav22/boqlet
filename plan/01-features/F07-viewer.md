# F07 3D viewer

## Purpose

Show where a number comes from. Click a line and see its elements. Click an element and see
which lines it feeds. Spot what is not measured.

## Behaviour

1. **Source of geometry:** the engine's per-version `geometry.glb` (one mesh node per GlobalId,
   float32, for display) and `scene.json` (engine `SceneIndex`: per element IFC class, name,
   type, storey, parent, the mesh nodes that draw it; spaces; openings). Fetched by
   `GET /model-versions/{id}/geometry` (302 to a signed URL, cached by the browser:
   immutable) and `GET /model-versions/{id}/scene`.
2. **Several models:** the viewer loads every model version in the run's inputs into one
   scene, with a toggle per model (and its discipline colour). Shared coordinates are assumed
   (BR-32).
3. **Line → elements:** selecting a line (sheet or detail) highlights `trace.elements[].guid`,
   mapping through `scene.elements[guid].parts` for aggregates (roofs, stairs), and frames
   them. Everything else is ghosted (setting: ghost / hide / normal).
4. **Element → lines:** clicking an element shows a panel: IFC class, name, type, storey,
   model, key properties, and **the lines it contributes to** (`GET /runs/{runId}/elements/{guid}`
   → `{element, lines: [{lineKey, description, quantity share}]}`). Each line is clickable back
   to the sheet.
5. **Colour modes:**
   - *Coverage*: measured (in at least one line), excluded (by scope or rule), unmatched
     (question), covered by parent. Built from `RunLineElement` + run questions.
   - *Code group*: colour by top-level group of the chosen classification.
   - *Source*: measured / derived-from / overridden.
   - *Model*: colour per discipline.
6. **Tools (v1):** orbit/pan/zoom, fit to selection, storey filter (show one storey), section
   box (one box, axis-aligned), isolate selection, hide selection, reset. No measuring tools in v1.
7. **Entry points:** the Viewer tab in the BoQ workspace (split with the sheet on wide screens),
   "Show in 3D" from line detail, questions and input-check rows, and the model version page
   (no run: coverage mode unavailable, only checks).
8. **Performance:** load glb progressively per model. Show element count and load progress.
   Above 200k elements, merge meshes per material for display and keep picking by an id
   buffer (see `06-frontend/architecture.md`).

## Reuse

The PoC viewer (`apps/web/src/viewer/SceneView.ts`, `links.ts`, `ModelPanel.tsx`) already
does line ↔ element linking with three.js over `geometry.glb`. Port it: keep the
GlobalId-named node convention and the `SceneIndex.parts` mapping. D66 (That Open Engine) stays
an option for later sections/plans/measuring; v1 keeps the engine-produced glb so there is one
geometry source of truth.

## API

`GET /model-versions/{versionId}/geometry`, `GET /model-versions/{versionId}/scene`,
`GET /runs/{runId}/elements/{guid}`, `GET /runs/{runId}/coverage` (per GlobalId status for
colour mode; compact arrays).

## Acceptance criteria

- [ ] Selecting a Duplex line highlights exactly its trace elements (roof lines highlight the roof slab parts).
- [ ] Clicking any element lists every line it contributes to, with its share.
- [ ] Coverage mode shows unmatched elements in a distinct colour, and their count equals the `unmatched` question occurrences.
- [ ] A two-model run shows both models, each toggleable.
- [ ] The Duplex viewer is interactive within 3 s of opening the tab on a warm cache.
