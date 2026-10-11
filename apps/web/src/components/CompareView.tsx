import type { BoqLine, BoqResult } from "@ifc-boq/types";
import { qty } from "../format";

export interface Pinned {
  label: string;
  result: BoqResult;
  classification?: string;
}

/** Two results side by side: pin one, change rules or classification, generate again. */
export function CompareView({ pinned, current, onClear }: { pinned: Pinned | null; current: Pinned; onClear: () => void }) {
  if (!pinned)
    return (
      <div className="empty-panel">
        <p>
          Press <b>Pin for comparison</b>, then change the rules or classification on the left and generate again. The two bills appear here side by side.
        </p>
      </div>
    );
  return (
    <div>
      <div className="compare-tools">
        <button className="link" onClick={onClear}>
          Unpin
        </button>
      </div>
      <div className="compare">
        <Column title="Pinned" run={pinned} />
        <Column title="Current" run={current} />
      </div>
    </div>
  );
}

function Column({ title, run }: { title: string; run: Pinned }) {
  const groups = new Map<string, BoqLine[]>();
  for (const l of run.result.lines) {
    const top = run.classification ? l.codes[run.classification]?.path[0] : undefined;
    const k = top ? `${top.code} ${top.title}` : "Unclassified";
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }
  const totals = new Map<string, number>();
  for (const l of run.result.lines) if (l.quantity !== null) totals.set(l.unit, (totals.get(l.unit) ?? 0) + l.quantity);
  return (
    <div className="compare-col">
      <h2>{title}</h2>
      <p className="muted small">{run.label}</p>
      <p className="small">
        {run.result.lines.length} lines.{" "}
        {[...totals.entries()].filter(([u]) => ["m2", "m3", "t", "m"].includes(u)).map(([u, v]) => `${qty(v, u)} ${u}`).join(", ")}
      </p>
      {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([g, ls]) => (
        <div key={g} className="compare-group">
          <h3>{g}</h3>
          <ul className="plain">
            {ls.map((l) => (
              <li key={l.key}>
                <span>{l.description}</span>
                <span className="num">
                  {l.quantity === null ? "to confirm" : qty(l.quantity, l.unit)} {l.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
