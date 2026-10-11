import { useEffect, useMemo, useState } from "react";
import type { BoqResult, CodeList, Decision, PresetsResponse, Question } from "@ifc-boq/types";
import { api } from "../api";

interface Props {
  result: BoqResult;
  presets: PresetsResponse | null;
  decisions: Decision[];
  running: boolean;
  onApply: (answers: Decision[]) => void;
}

/**
 * Open questions from the engine. Blocking ones stop the BoQ from being complete.
 * Answers become Decisions, are sent with the next run and stay applied for this model.
 */
export function QuestionsView({ result, presets, decisions, running, onApply }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [codeLists, setCodeLists] = useState<Record<string, CodeList>>({});
  const systems = useMemo(
    () => [...new Set(result.questions.flatMap((q) => (q.answer.kind === "code" ? [q.answer.system] : [])))],
    [result],
  );
  useEffect(() => {
    for (const s of systems) {
      if (codeLists[s]) continue;
      api.preset("classifications", s).then((p) => {
        const cl = (p as { codeList: CodeList }).codeList;
        if (cl) setCodeLists((x) => ({ ...x, [s]: cl }));
      }).catch(() => undefined);
    }
  }, [systems, codeLists]);

  const ordered = [...result.questions].sort((a, b) => Number(b.blocking) - Number(a.blocking));
  const filled = Object.entries(draft).filter(([, v]) => v !== "");

  const submit = () =>
    onApply(
      filled.map(([questionId, v]) => {
        const q = result.questions.find((x) => x.id === questionId)!;
        return { questionId, scope: "project", answer: q.answer.kind === "number" ? Number(v) : v };
      }),
    );

  if (result.questions.length === 0)
    return (
      <div className="empty-panel">
        <p>No open questions. Every element the rules need was understood and measured.</p>
        {decisions.length > 0 && <p className="muted">{decisions.length} earlier answer(s) are applied.</p>}
      </div>
    );

  return (
    <div className="questions">
      <p className="muted">
        Blocking questions must be answered for a complete BoQ. The others explain what the rules left out; answering them is optional.
        Answers are kept for this model and re-applied on every run.
      </p>
      <ul className="q-list">
        {ordered.map((q) => (
          <li key={q.id} className={q.blocking ? "q blocking" : "q"}>
            <div className="q-text">
              <span className="q-kind">{q.blocking ? "Blocking" : "Optional"}, {q.kind.replace(/_/g, " ")}</span>
              <p>{q.message}</p>
            </div>
            <Answer q={q} value={draft[q.id] ?? ""} onChange={(v) => setDraft({ ...draft, [q.id]: v })} presets={presets} result={result} codeLists={codeLists} />
          </li>
        ))}
      </ul>
      <div className="q-actions">
        <button className="primary" disabled={filled.length === 0 || running} onClick={submit}>
          {running ? "Generating" : `Apply ${filled.length || ""} answer${filled.length === 1 ? "" : "s"} and regenerate`}
        </button>
      </div>
    </div>
  );
}

function Answer({ q, value, onChange, presets, result, codeLists }: {
  q: Question; value: string; onChange: (v: string) => void; presets: PresetsResponse | null; result: BoqResult; codeLists: Record<string, CodeList>;
}) {
  const a = q.answer;
  if (a.kind === "number")
    return (
      <label className="answer">
        <input type="number" step="any" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Value" /> {a.unit}
      </label>
    );
  if (a.kind === "term") {
    const terms = (presets?.terms ?? []).filter((t) => !a.category || (a.category === "material" ? ["material", "product"].includes(t.category) : t.category === a.category));
    return (
      <select className="answer" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Choose what this is">
        <option value="">Leave unanswered</option>
        {terms.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label} ({t.id})
          </option>
        ))}
      </select>
    );
  }
  if (a.kind === "rule")
    return (
      <select className="answer" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Assign a rule">
        <option value="">Leave unmatched</option>
        <option value="exclude">Exclude from the BoQ</option>
        {result.ruleSet.items.map((i) => (
          <option key={i.id} value={i.id}>
            Measure with rule: {i.label}
          </option>
        ))}
      </select>
    );
  if (a.kind === "code") {
    const cl = codeLists[a.system];
    return (
      <select className="answer" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Choose a code">
        <option value="">Leave unclassified</option>
        {(cl?.codes ?? []).map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} {c.title}
          </option>
        ))}
      </select>
    );
  }
  return (
    <select className="answer" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Leave unanswered</option>
      {a.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
