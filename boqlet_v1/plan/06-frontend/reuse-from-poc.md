# What to reuse from the PoC (`apps/web`)

The PoC is React 18 + Vite with plain CSS and a hand-written API client against the engine's
dev API. About 10k lines. Much of its domain UI logic is worth keeping. Its shell and data
access are not.

| PoC file(s) | Lines | Verdict | Into | Changes |
|---|---|---|---|---|
| `library/readable.ts`, `library/vocab.ts` | 450 | **Port as is** | `features/library/lib` | Move UI strings in `vocab.ts` (`NAMES`, labels) to i18n messages; keep the formula ↔ readable mapping logic |
| `library/itemStory.tsx`, `classStory.tsx`, `dictStory.tsx` | 790 | **Port** | `features/library/story` | Sentences through i18n with ICU params; keep structure |
| `library/RuleSetEditor.tsx`, `QuestionSetup.tsx`, `QuestionsTab.tsx`, `ruleParts.tsx`, `fields.tsx` | 2,800 | **Port and restyle** | `features/library/rule-set` | Data: drafts via `PUT /presets/{id}/draft` (autosave + ETag), check results from the response; replace raw inputs with design-system fields |
| `library/ClassificationEditor.tsx`, `ClassTable.tsx`, `CodeImport.tsx` | 1,300 | **Port and restyle** | `features/library/classification` | Import via `/codelists/read` + `/build`; paged tables for big code lists |
| `library/DictionaryEditor.tsx`, `NamesTab.tsx` | 920 | **Port and restyle** | `features/library/dictionary` | Names via `POST /model-versions/{id}/names` with a model-version picker |
| `library/Library.tsx`, `store.ts`, `JsonTab.tsx` | 900 | **Rewrite, keep ideas** | `features/library` | The new shell has layers, versions, publish, preview, usage. `store.ts` → Zustand draft store keyed by presetId |
| `viewer/SceneView.ts`, `links.ts` | 280 | **Port** | `src/viewer` | Load several model versions; colour modes (coverage, code, source, model, changes); id-buffer picking for big models |
| `viewer/ModelPanel.tsx` | 160 | **Rewrite** | `features/viewer` | Element panel with lines from `GET /runs/{id}/elements/{guid}` |
| `components/BoqSheet.tsx` | 160 | **Rewrite, keep ideas** | `features/boq-sheet` | TanStack Table + Virtual, grouping by any system, overrides, manual lines |
| `components/QuestionsView.tsx` | 140 | **Rewrite, keep answer controls** | `features/questions` | Bulk answers, decisions, promote, dryRun warning |
| `components/LogView.tsx` | 90 | **Rewrite** | `features/boq-sheet/log` | Paged, filtered server-side |
| `components/CompareView.tsx` | — | **Replace** | `features/changes` | The engine diff (EN-002) replaces client-side comparison |
| `components/InputsView.tsx`, `Sidebar.tsx`, `SideHead.tsx`, `App.tsx` | 640 | **Drop** | — | The new app shell and setup panel replace them |
| `api.ts` | 140 | **Drop** | — | The generated client replaces it |
| `format.ts` | — | **Port** | `src/i18n/formatters` | Locale-aware via `Intl` |
| `styles.css`, `library.css`, `viewer.css` | 1,900 | **Drop** | — | The design system replaces them; keep the visual language (ruled sheet) as reference |

Rules for porting:
1. Port in the same commit as a test that renders the component with a fixture document from
   `presets/` (as-modelled, acme-cost-codes, global-seed).
2. Keep `apps/web` working until the product reaches milestone M2. It stays the engine
   developers' tool after that.
3. No formula evaluation moves into the browser (BR-01). The PoC never did this and the port
   must not start.
