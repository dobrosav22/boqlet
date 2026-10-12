/**
 * The 3D panel beside the BoQ sheet. Selecting a line highlights its elements; clicking an element
 * lists the lines it is in. Colour modes show element type, what the BoQ covers, or code groups.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { BoqLine, SceneIndex } from "@ifc-boq/types";
import { api } from "../api";
import { qty } from "../format";
import { SceneView } from "./SceneView";
import { colorsFor, type ColorMode, type Links } from "./links";

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export function ModelPanel({ modelIds, primary, scene, links, selected, onSelectLine }: {
  /** Every model of the BoQ; their geometry is loaded into one scene. */
  modelIds: string[];
  primary?: string;
  scene: SceneIndex | null;
  links: Links;
  selected: BoqLine | null;
  onSelectLine: (key: string | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<SceneView | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ColorMode>("type");
  const [spaces, setSpaces] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  // one viewer for the models of this BoQ
  const idsKey = modelIds.join(",");
  useEffect(() => {
    if (!host.current || !scene) return;
    const v = new SceneView(host.current);
    view.current = v;
    setReady(false);
    setError(null);
    const classes = new Map(Object.entries(scene.elements).map(([g, e]) => [g, e.ifcClass]));
    modelIds
      .reduce((p, id) => p.then(() => v.load(api.geometryUrl(id), classes, scene.spaces, scene.openings)), Promise.resolve())
      .then(() => {
        v.fit();
        setReady(true);
      })
      .catch((e: Error) => setError(`Could not load the 3D model: ${e.message}`));
    return () => {
      v.dispose();
      view.current = null;
    };
  }, [idsKey, scene]);

  useEffect(() => {
    if (view.current) view.current.onPick = (guid) => {
      setPicked(guid && scene?.elements[guid] ? guid : null);
      if (!guid) onSelectLine(null);
    };
  }, [scene, onSelectLine, ready]);

  const { colors, legend } = useMemo(() => colorsFor(mode, scene, links, primary), [mode, scene, links, primary]);
  const focusElements = selected ? links.elementsOf(selected) : picked ? [picked] : [];
  const focusKey = focusElements.join(",");

  useEffect(() => {
    if (!ready || !view.current) return;
    const focus = focusElements.length ? links.meshesOf(focusElements) : undefined;
    view.current.paint({ colors, focus });
  }, [ready, colors, focusKey, links]);

  // frame a selected line's elements (not on every colour change)
  useEffect(() => {
    if (ready && view.current && selected) view.current.fit(links.meshesOf(links.elementsOf(selected)));
  }, [ready, selected, links]);

  useEffect(() => view.current?.setShowSpaces(spaces), [spaces, ready]);
  useEffect(() => setPicked(null), [selected]);

  const info = picked ? scene?.elements[picked] : undefined;
  const pickedLines = picked ? links.linesOf(picked) : [];
  const parent = info?.parent ? scene?.elements[info.parent] : undefined;

  return (
    <div className="model-panel">
      <div className="mp-tools">
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as ColorMode);
            setPicked(null); // show the colours, not a single picked element
          }}
          aria-label="Colour by"
        >
          <option value="type">Colour by element type</option>
          <option value="coverage">Colour by what the BoQ covers</option>
          <option value="code" disabled={!primary}>
            Colour by code group
          </option>
        </select>
        <label className="option inline">
          <input type="checkbox" checked={spaces} onChange={(e) => setSpaces(e.target.checked)} />
          <span>Rooms</span>
        </label>
        <button type="button" className="ghost small-btn" onClick={() => view.current?.fit()}>
          Fit all
        </button>
      </div>
      <div className="mp-canvas" ref={host}>
        {!ready && !error && <span className="mp-msg">Loading the model…</span>}
        {error && <span className="mp-msg error">{error}</span>}
      </div>
      {legend.length > 0 && (
        <ul className="mp-legend">
          {legend.map((l) => (
            <li key={l.label}>
              <span className="swatch" style={{ background: hex(l.color) }} />
              {l.label} <span className="muted">{l.count}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mp-info">
        {selected && !picked && (
          <p className="small">
            <b>{selected.description}</b>: {focusElements.length} element{focusElements.length === 1 ? "" : "s"} highlighted.{" "}
            {focusElements.length === 0 && "This line has no model elements (a manual item)."}{" "}
            <button type="button" className="link small" onClick={() => onSelectLine(null)}>
              clear
            </button>
          </p>
        )}
        {info && (
          <div className="small">
            <p>
              <b>{info.name || info.type || picked}</b> <span className="muted">{info.ifcClass.replace(/^Ifc/, "")}{info.storey ? `, ${info.storey}` : ""}</span>
              {parent && <span className="muted"> · part of {parent.name || parent.ifcClass}</span>}
            </p>
            {pickedLines.length === 0 ? (
              <p className="muted">Not in any BoQ line (excluded or not measured by the rules).</p>
            ) : (
              <>
                <p className="muted">In {pickedLines.length} line{pickedLines.length === 1 ? "" : "s"}:</p>
                <ul className="mp-lines">
                  {pickedLines.map((l) => (
                    <li key={l.key}>
                      <button type="button" className="link" onClick={() => onSelectLine(l.key)}>
                        {l.description}
                      </button>{" "}
                      <span className="muted">
                        {l.quantity === null ? "to confirm" : `${qty(l.quantity, l.unit)} ${l.unit}`}
                        {l.ruleKind !== "item" ? ` · ${l.ruleKind}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        {!selected && !info && <p className="muted small">Select a BoQ line to see its elements, or click an element to see its lines. Drag to orbit, scroll to zoom, right-drag to pan.</p>}
      </div>
    </div>
  );
}
