import { Fragment, useMemo, useState } from "react";
import type { BoqLine, BoqResult } from "@ifc-boq/types";
import { qty } from "../format";

interface Props {
  result: BoqResult;
  primary?: string;
  onShowInLog: (lineKey: string) => void;
}

interface Group {
  code: string;
  title: string;
  lines: BoqLine[];
}

/** The BoQ drawn as ruled dimension paper: Ref | Description | Quantity | Unit. Click a line for its calculation. */
export function BoqSheet({ result, primary, onShowInLog }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const l of result.lines) {
      const c = primary ? l.codes[primary] : undefined;
      const top = c?.path[0];
      const key = top?.code ?? "~";
      if (!map.has(key)) map.set(key, { code: top?.code ?? "", title: top?.title ?? (primary ? "Unclassified" : "All lines"), lines: [] });
      map.get(key)!.lines.push(l);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => g);
  }, [result, primary]);

  return (
    <div className="sheet" role="table" aria-label="Bill of quantities">
      <div className="sheet-row sheet-head" role="row">
        <span role="columnheader">Ref</span>
        <span role="columnheader">Description</span>
        <span role="columnheader" className="num">
          Quantity
        </span>
        <span role="columnheader">Unit</span>
      </div>
      {groups.map((g) => (
        <Fragment key={g.code + g.title}>
          <div className="sheet-row sheet-group" role="row">
            <span>{g.code}</span>
            <span>{g.title}</span>
            <span />
            <span />
          </div>
          {g.lines.map((l) => {
            const code = primary ? l.codes[primary]?.code : "";
            const isOpen = open === l.key;
            return (
              <Fragment key={l.key}>
                <button
                  className={`sheet-row sheet-line ${l.quantity === null ? "flagged" : ""} ${isOpen ? "open" : ""} src-${l.source}`}
                  onClick={() => setOpen(isOpen ? null : l.key)}
                  aria-expanded={isOpen}
                  role="row"
                >
                  <span>{code}</span>
                  <span>
                    {l.description}
                    {l.ruleKind !== "item" && <em className="kind">{l.ruleKind}</em>}
                  </span>
                  <span className="num">{l.quantity === null ? "to confirm" : qty(l.quantity, l.unit)}</span>
                  <span>{l.unit}</span>
                </button>
                {isOpen && <LineDetail line={l} onShowInLog={onShowInLog} />}
              </Fragment>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

function LineDetail({ line, onShowInLog }: { line: BoqLine; onShowInLog: (k: string) => void }) {
  const params = Object.entries(line.trace.params);
  const codes = Object.values(line.codes);
  return (
    <div className="detail">
      <div className="detail-grid">
        <div>
          <h3>Formula</h3>
          <code className="formula">{line.trace.formula}</code>
          {line.trace.sourceLine && <p className="small muted">Derived from line {line.trace.sourceLine}</p>}
        </div>
        {params.length > 0 && (
          <div>
            <h3>Parameters used</h3>
            <dl className="params">
              {params.map(([k, v]) => (
                <Fragment key={k}>
                  <dt>{k}</dt>
                  <dd>{JSON.stringify(v)}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        )}
        {codes.length > 0 && (
          <div>
            <h3>Codes</h3>
            <ul className="plain">
              {codes.map((c) => (
                <li key={c.system}>
                  <b>{c.code}</b> {c.title} <span className="muted">({c.system}, {c.mapRuleId ? `map rule ${c.mapRuleId}` : c.source})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {line.notes.length > 0 && <p className="note">{line.notes.join(" ")}</p>}
      {line.trace.elements.length > 0 && (
        <table className="contrib">
          <thead>
            <tr>
              <th>Element</th>
              <th className="num">Quantity</th>
              <th>How</th>
            </tr>
          </thead>
          <tbody>
            {line.trace.elements.map((e, i) => (
              <tr key={e.guid + i}>
                <td title={e.guid}>{e.name || e.guid}</td>
                <td className="num">{e.quantity === null ? "missing" : qty(e.quantity, line.unit === "t" ? "t" : undefined)}</td>
                <td className="how">{e.note}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>
                {line.trace.elements.length} element{line.trace.elements.length === 1 ? "" : "s"}
              </td>
              <td className="num">
                <b>{line.quantity === null ? "to confirm" : qty(line.quantity, line.unit)}</b> {line.unit}
              </td>
              <td>
                <button className="link" onClick={() => onShowInLog(line.key)}>
                  Show this line in the calculation log
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
