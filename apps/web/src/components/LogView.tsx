import { useMemo } from "react";
import type { LogEntry, LogStage } from "@ifc-boq/types";

export interface LogFilter {
  stages: LogStage[];
  showDetail: boolean;
  q: string;
  lineKey?: string;
}

const STAGES: [LogStage, string][] = [
  ["parse", "Parse"],
  ["names", "Names"],
  ["measure", "Measure"],
  ["match", "Rule matching"],
  ["quantity", "Quantities"],
  ["derived", "Derived"],
  ["manual", "Manual items"],
  ["classify", "Classification"],
  ["decision", "Answers"],
  ["summary", "Summary"],
];

/** The engine's calculation log, in order. Filter by stage, by line, or by text. */
export function LogView({ entries, filter, onFilter }: { entries: LogEntry[]; filter: LogFilter; onFilter: (f: LogFilter) => void }) {
  const shown = useMemo(() => {
    const q = filter.q.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (filter.stages.length === 0 || filter.stages.includes(e.stage)) &&
        (filter.showDetail || e.level !== "detail") &&
        (!filter.lineKey || e.lineKey === filter.lineKey) &&
        (!q || e.message.toLowerCase().includes(q) || (e.ruleId ?? "").toLowerCase().includes(q) || (e.guid ?? "").toLowerCase().includes(q)),
    );
  }, [entries, filter]);
  const counts = useMemo(() => {
    const c: Partial<Record<LogStage, number>> = {};
    for (const e of entries) c[e.stage] = (c[e.stage] ?? 0) + 1;
    return c;
  }, [entries]);

  const toggleStage = (s: LogStage) =>
    onFilter({ ...filter, stages: filter.stages.includes(s) ? filter.stages.filter((x) => x !== s) : [...filter.stages, s] });

  return (
    <div className="log">
      <div className="log-tools">
        <input
          type="search"
          placeholder="Search messages, rules or element ids"
          value={filter.q}
          onChange={(e) => onFilter({ ...filter, q: e.target.value })}
          aria-label="Search the log"
        />
        <label className="option inline">
          <input type="checkbox" checked={filter.showDetail} onChange={(e) => onFilter({ ...filter, showDetail: e.target.checked })} />
          <span>Per-element detail</span>
        </label>
      </div>
      <div className="chips">
        {STAGES.filter(([s]) => counts[s]).map(([s, label]) => (
          <button key={s} className={`chip toggle ${filter.stages.includes(s) ? "on" : ""}`} onClick={() => toggleStage(s)} aria-pressed={filter.stages.includes(s)}>
            {label} {counts[s]}
          </button>
        ))}
        {filter.lineKey && (
          <button className="chip toggle on" onClick={() => onFilter({ ...filter, lineKey: undefined })}>
            Line: {filter.lineKey} (clear)
          </button>
        )}
      </div>
      <p className="small muted">
        Showing {shown.length} of {entries.length} entries.
      </p>
      <ol className="log-list">
        {shown.map((e) => (
          <li key={e.seq} className={`log-${e.level}`}>
            <span className="log-seq">{e.seq}</span>
            <span className="log-stage">{e.stage}</span>
            <span className="log-msg">
              {e.message}
              {e.ruleId && <span className="muted"> (rule {e.ruleId})</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
