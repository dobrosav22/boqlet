import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import type { Decision, ModelSummary, PresetsResponse, RunResponse, SceneIndex } from "@ifc-boq/types";
import { api } from "./api";
import { Sidebar, type LoadedModel, type Settings } from "./components/Sidebar";
import { BoqSheet } from "./components/BoqSheet";
import { LogView, type LogFilter } from "./components/LogView";
import { QuestionsView } from "./components/QuestionsView";
import { InputsView } from "./components/InputsView";
import { CompareView, type Pinned } from "./components/CompareView";
import { SideHead, type Mode } from "./components/SideHead";
import { Library } from "./library/Library";
import type { LibState } from "./library/store";
import { ms } from "./format";
import { buildLinks } from "./viewer/links";

// three.js is large: load the 3D panel only when it is first shown
const ModelPanel = lazy(() => import("./viewer/ModelPanel").then((m) => ({ default: m.ModelPanel })));

type Tab = "boq" | "log" | "questions" | "inputs" | "compare";

export function App() {
  const [presets, setPresets] = useState<PresetsResponse | null>(null);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  // Several models can be combined into one BoQ (federation); `model` is the first included one.
  const [models, setModels] = useState<LoadedModel[]>([]);
  const active = useMemo(() => models.filter((m) => m.on), [models]);
  const model: ModelSummary | null = active[0]?.summary ?? null;
  const activeKey = active.map((m) => m.summary.modelId).join(",");
  const [settings, setSettings] = useState<Settings>({ ruleSet: "", dictionaries: [], classifications: [] });
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Pinned | null>(null);
  const [tab, setTab] = useState<Tab>("boq");
  const [logFilter, setLogFilter] = useState<LogFilter>({ stages: [], showDetail: true, q: "" });
  const [mode, setMode] = useState<Mode>("boq");
  const [scene, setScene] = useState<SceneIndex | null>(null);
  const [show3d, setShow3d] = useState(true);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const selectLine = useCallback((key: string | null) => setSelectedLine(key), []);
  useEffect(() => {
    setScene(null);
    if (!active.length) return;
    // one scene index over all included models (element GlobalIds are unique across them)
    Promise.all(active.map((m) => api.scene(m.summary.modelId)))
      .then((ss) => setScene({
        elements: Object.assign({}, ...ss.map((x) => x.elements)),
        spaces: ss.flatMap((x) => x.spaces),
        openings: ss.flatMap((x) => x.openings),
      }))
      .catch(() => setShow3d(false));
  }, [activeKey]);
  // Library drafts live here so they survive switching between the two modes.
  const [lib, setLib] = useState<LibState>({});
  const [libSel, setLibSel] = useState<string | null>(null);

  /** keep: after saving or deleting a preset, keep the BoQ choices that still exist instead of resetting them. */
  const loadPresets = (keep?: unknown) => {
    setPresetsError(null);
    api
      .presets()
      .then((p) => {
        setPresets(p);
        setSettings((s) => {
          const ruleSet = p.ruleSets.find((r) => r.id === "as-modelled")?.id ?? p.ruleSets[0]?.id ?? "";
          if (keep !== true)
            return {
              ruleSet,
              dictionaries: p.dictionaries.filter((d) => d.id === "global-seed").map((d) => d.id),
              classifications: p.classifications.filter((c) => c.id === "acme-cost-codes" && c.available).map((c) => c.id),
            };
          return {
            ruleSet: p.ruleSets.some((r) => r.id === s.ruleSet) ? s.ruleSet : ruleSet,
            dictionaries: s.dictionaries.filter((id) => p.dictionaries.some((d) => d.id === id)),
            classifications: s.classifications.filter((id) => p.classifications.some((c) => c.id === id && c.available)),
          };
        });
      })
      .catch((e: Error) => setPresetsError(e.message));
  };
  useEffect(loadPresets, []);

  const generate = async (withDecisions = decisions) => {
    if (!active.length) return;
    setRunning(true);
    setRunError(null);
    try {
      const r = await api.run({
        models: active.map((m) => ({ modelId: m.summary.modelId, discipline: m.discipline })),
        ...settings,
        decisions: withDecisions,
      });
      setRun(r);
      if (r.result.status === "needs_input") setTab("questions");
    } catch (e) {
      setRunError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  // A dropped file joins the models of this BoQ; answers stay (question ids are content-based).
  const onModel = (m: ModelSummary) => {
    setModels((prev) => (prev.some((x) => x.summary.modelId === m.modelId) ? prev
      : [...prev, { summary: m, discipline: m.disciplineGuess ?? "unknown", on: true }]));
    setRun(null);
    setPinned(null);
    setTab("boq");
  };
  const onModels = (next: LoadedModel[]) => {
    setModels(next);
    setRun(null);
    setPinned(null);
  };

  const applyAnswers = (answers: Decision[]) => {
    const merged = [...decisions.filter((d) => !answers.some((a) => a.questionId === d.questionId)), ...answers];
    setDecisions(merged);
    void generate(merged);
  };

  const showInLog = (lineKey: string) => {
    setLogFilter({ stages: [], showDetail: true, q: "", lineKey });
    setTab("log");
  };

  const result = run?.result;
  const links = useMemo(() => (result ? buildLinks(result, scene) : null), [result, scene]);
  const selected = result?.lines.find((l) => l.key === selectedLine) ?? null;
  const primary = settings.classifications[0];
  const blocking = result?.questions.filter((q) => q.blocking).length ?? 0;
  const runLabel = useMemo(() => {
    if (!presets || !result) return "";
    const rs = presets.ruleSets.find((r) => r.id === result.ruleSet.id)?.name ?? result.ruleSet.id;
    const cl = settings.classifications.map((c) => presets.classifications.find((x) => x.id === c)?.name ?? c).join(", ");
    return `${rs}${cl ? ` / ${cl}` : ""}`;
  }, [presets, result, settings.classifications]);

  const head = <SideHead mode={mode} onMode={setMode} />;
  if (mode === "library") {
    return (
      <div className="app">
        <Library
          head={head}
          model={model}
          onOpenBoq={() => setMode("boq")}
          presets={presets}
          presetsError={presetsError}
          onRetryPresets={loadPresets}
          onPresetsChanged={() => loadPresets(true)}
          lib={lib}
          setLib={setLib}
          sel={libSel}
          setSel={setLibSel}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        head={head}
        presets={presets}
        presetsError={presetsError}
        onRetryPresets={loadPresets}
        models={models}
        onModel={onModel}
        onModels={onModels}
        settings={settings}
        onSettings={setSettings}
        decisions={decisions}
        onClearDecisions={() => setDecisions([])}
        running={running}
        onGenerate={() => void generate()}
      />
      <main className="main">
        {!result && (
          <div className="empty">
            <h1>Bill of quantities from an IFC model</h1>
            <p>
              Drop an IFC file on the left, keep the default rules and classification, and press <b>Generate BoQ</b>.
              Every quantity can be traced back to its formula and elements.
            </p>
            <p className="muted">
              Try it with <code>fixtures/ifc/Ifc2x3_Duplex_Architecture.ifc</code> from this repository.
            </p>
            {runError && <p className="error">{runError}</p>}
            <div className="sheet sheet-blank" aria-hidden>
              <div className="sheet-row sheet-head">
                <span>Ref</span>
                <span>Description</span>
                <span className="num">Quantity</span>
                <span>Unit</span>
              </div>
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="sheet-row">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          </div>
        )}
        {result && run && (
          <>
            <header className="result-head">
              <div>
                <h1>{active.map((m) => m.summary.fileName).join(" + ")}</h1>
                <p className="muted">
                  {runLabel}. {result.stats.lines} lines from {result.stats.measuredElements} of {result.stats.elements} elements,
                  calculated in {ms(result.stats.durationMs)}.
                </p>
              </div>
              <div className="head-actions">
                <span className={`status status-${result.status}`}>
                  {result.status === "complete" ? "Complete" : `Needs input: ${blocking} question${blocking === 1 ? "" : "s"}`}
                </span>
                <button className={show3d ? "ghost on" : "ghost"} aria-pressed={show3d} onClick={() => setShow3d(!show3d)} disabled={!scene}>
                  3D view
                </button>
                <button className="ghost" onClick={() => setPinned({ label: runLabel, result, classification: primary })}>
                  Pin for comparison
                </button>
                <a className="button" href={run.xlsxUrl}>
                  Download Excel
                </a>
              </div>
            </header>
            {runError && <p className="error">{runError}</p>}
            <nav className="tabs" role="tablist">
              {(
                [
                  ["boq", "Bill of quantities"],
                  ["log", `Calculation log (${result.log.length})`],
                  ["questions", `Questions (${result.questions.length})`],
                  ["inputs", "Inputs"],
                  ["compare", pinned ? "Compare" : "Compare (pin a result first)"],
                ] as [Tab, string][]
              ).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "tab active" : "tab"} onClick={() => setTab(id)}>
                  {label}
                  {id === "questions" && blocking > 0 && <span className="dot" aria-label="blocking questions" />}
                </button>
              ))}
            </nav>
            <section className="panel">
              {tab === "boq" && (
                <div className={show3d && scene && links && model ? "boq-split" : undefined}>
                  <BoqSheet result={result} primary={primary} onShowInLog={showInLog} selected={selectedLine} onSelect={selectLine} />
                  {show3d && scene && links && model && (
                    <Suspense fallback={<div className="model-panel"><div className="mp-canvas"><span className="mp-msg">Loading the 3D view…</span></div></div>}>
                      <ModelPanel modelIds={active.map((m) => m.summary.modelId)} primary={primary} scene={scene} links={links} selected={selected} onSelectLine={selectLine} />
                    </Suspense>
                  )}
                </div>
              )}
              {tab === "log" && <LogView entries={result.log} filter={logFilter} onFilter={setLogFilter} />}
              {tab === "questions" && (
                <QuestionsView result={result} presets={presets} decisions={decisions} running={running} onApply={applyAnswers} />
              )}
              {tab === "inputs" && <InputsView result={result} settings={settings} presets={presets} />}
              {tab === "compare" && <CompareView pinned={pinned} current={{ label: runLabel, result, classification: primary }} onClear={() => setPinned(null)} />}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
