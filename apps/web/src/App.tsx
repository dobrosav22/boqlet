import { useEffect, useMemo, useState } from "react";
import type { Decision, ModelSummary, PresetsResponse, RunResponse } from "@ifc-boq/types";
import { api } from "./api";
import { Sidebar, type Settings } from "./components/Sidebar";
import { BoqSheet } from "./components/BoqSheet";
import { LogView, type LogFilter } from "./components/LogView";
import { QuestionsView } from "./components/QuestionsView";
import { InputsView } from "./components/InputsView";
import { CompareView, type Pinned } from "./components/CompareView";
import { ms } from "./format";

type Tab = "boq" | "log" | "questions" | "inputs" | "compare";

export function App() {
  const [presets, setPresets] = useState<PresetsResponse | null>(null);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const [model, setModel] = useState<ModelSummary | null>(null);
  const [settings, setSettings] = useState<Settings>({ ruleSet: "", dictionaries: [], classifications: [] });
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Pinned | null>(null);
  const [tab, setTab] = useState<Tab>("boq");
  const [logFilter, setLogFilter] = useState<LogFilter>({ stages: [], showDetail: true, q: "" });

  const loadPresets = () => {
    setPresetsError(null);
    api
      .presets()
      .then((p) => {
        setPresets(p);
        setSettings({
          ruleSet: p.ruleSets.find((r) => r.id === "as-modelled")?.id ?? p.ruleSets[0]?.id ?? "",
          dictionaries: p.dictionaries.filter((d) => d.id === "global-seed").map((d) => d.id),
          classifications: p.classifications.filter((c) => c.id === "acme-cost-codes" && c.available).map((c) => c.id),
        });
      })
      .catch((e: Error) => setPresetsError(e.message));
  };
  useEffect(loadPresets, []);

  const generate = async (withDecisions = decisions) => {
    if (!model) return;
    setRunning(true);
    setRunError(null);
    try {
      const r = await api.run({ modelId: model.modelId, ...settings, decisions: withDecisions });
      setRun(r);
      if (r.result.status === "needs_input") setTab("questions");
    } catch (e) {
      setRunError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const onModel = (m: ModelSummary) => {
    setModel(m);
    setRun(null);
    setDecisions([]);
    setPinned(null);
    setTab("boq");
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
  const primary = settings.classifications[0];
  const blocking = result?.questions.filter((q) => q.blocking).length ?? 0;
  const runLabel = useMemo(() => {
    if (!presets || !result) return "";
    const rs = presets.ruleSets.find((r) => r.id === result.ruleSet.id)?.name ?? result.ruleSet.id;
    const cl = settings.classifications.map((c) => presets.classifications.find((x) => x.id === c)?.name ?? c).join(", ");
    return `${rs}${cl ? ` / ${cl}` : ""}`;
  }, [presets, result, settings.classifications]);

  return (
    <div className="app">
      <Sidebar
        presets={presets}
        presetsError={presetsError}
        onRetryPresets={loadPresets}
        model={model}
        onModel={onModel}
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
                <h1>{model?.fileName}</h1>
                <p className="muted">
                  {runLabel}. {result.stats.lines} lines from {result.stats.measuredElements} of {result.stats.elements} elements,
                  calculated in {ms(result.stats.durationMs)}.
                </p>
              </div>
              <div className="head-actions">
                <span className={`status status-${result.status}`}>
                  {result.status === "complete" ? "Complete" : `Needs input: ${blocking} question${blocking === 1 ? "" : "s"}`}
                </span>
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
              {tab === "boq" && <BoqSheet result={result} primary={primary} onShowInLog={showInLog} />}
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
