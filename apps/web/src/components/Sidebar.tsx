import { useRef, useState, type ReactNode } from "react";
import type { Decision, ModelSummary, PresetsResponse } from "@ifc-boq/types";
import { api } from "../api";
import { bytes, ms } from "../format";

export interface Settings {
  ruleSet: string;
  dictionaries: string[];
  classifications: string[];
}

interface Props {
  head: ReactNode;
  presets: PresetsResponse | null;
  presetsError: string | null;
  onRetryPresets: () => void;
  model: ModelSummary | null;
  onModel: (m: ModelSummary) => void;
  settings: Settings;
  onSettings: (s: Settings) => void;
  decisions: Decision[];
  onClearDecisions: () => void;
  running: boolean;
  onGenerate: () => void;
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export function Sidebar(p: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = async (file?: File) => {
    if (!file) return;
    setUploadError(null);
    setUploading(file.name);
    try {
      p.onModel(await api.uploadModel(file));
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(null);
    }
  };

  const m = p.model;
  const topClasses = m ? Object.entries(m.byClass).sort((a, b) => b[1] - a[1]).slice(0, 6) : [];

  return (
    <aside className="side">
      {p.head}

      <div
        className={`drop ${drag ? "drag" : ""} ${uploading ? "busy" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void upload(e.dataTransfer.files[0]);
        }}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      >
        <input ref={input} type="file" accept=".ifc,.ifczip" hidden data-testid="file-input" onChange={(e) => void upload(e.target.files?.[0])} />
        {uploading ? (
          <>
            <strong>Reading {uploading}</strong>
            <span>Parsing geometry and checking quantities. Small models take seconds, large ones minutes.</span>
          </>
        ) : (
          <>
            <strong>{m ? "Drop another IFC file" : "Drop an IFC file here"}</strong>
            <span>or click to choose one</span>
          </>
        )}
      </div>
      {uploadError && <p className="error">{uploadError}</p>}

      {m && (
        <div className="model">
          <div className="model-name">{m.fileName}</div>
          <dl>
            <dt>Schema</dt>
            <dd>{m.ifcSchema}</dd>
            <dt>Made with</dt>
            <dd>{m.authoringApp ?? "unknown"}</dd>
            <dt>Contents</dt>
            <dd>
              {m.elementCount} elements, {m.openingCount} openings, {m.spaceCount} spaces
            </dd>
            <dt>Storeys</dt>
            <dd>{m.storeys.map((s) => s.name).join(", ")}</dd>
            <dt>Parsed</dt>
            <dd>
              {bytes(m.sizeBytes)} in {ms(m.parseMs)}
              {m.cached ? " (cached)" : ""}
            </dd>
          </dl>
          <div className="chips">
            {topClasses.map(([c, n]) => (
              <span key={c} className="chip">
                {c.replace(/^Ifc/, "")} {n}
              </span>
            ))}
          </div>
          {Object.keys(m.checks).length > 0 && (
            <p className="small muted">
              Checks: {Object.entries(m.checks).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(", ")}
            </p>
          )}
        </div>
      )}

      {p.presetsError && (
        <div className="error">
          {p.presetsError}{" "}
          <button className="link" onClick={p.onRetryPresets}>
            Retry
          </button>
        </div>
      )}

      {p.presets && (
        <>
          <fieldset>
            <legend>Rules</legend>
            <p className="hint">How quantities are measured. Changes the numbers.</p>
            {p.presets.ruleSets.map((r) => (
              <label key={r.id} className="option">
                <input type="radio" name="ruleset" checked={p.settings.ruleSet === r.id} onChange={() => p.onSettings({ ...p.settings, ruleSet: r.id })} />
                <span>
                  {r.name}
                  {r.extends && <span className="muted">, extends {r.extends}</span>}
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>Classification</legend>
            <p className="hint">Codes and grouping. Never changes numbers. The first one ticked groups the sheet.</p>
            {p.presets.classifications.map((c) => (
              <label key={c.id} className={`option ${c.available ? "" : "disabled"}`} title={c.reason ?? ""}>
                <input
                  type="checkbox"
                  disabled={!c.available}
                  checked={p.settings.classifications.includes(c.id)}
                  onChange={() => p.onSettings({ ...p.settings, classifications: toggle(p.settings.classifications, c.id) })}
                />
                <span>
                  {c.name}
                  {!c.available && <span className="muted block">{c.reason}</span>}
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>Dictionaries</legend>
            <p className="hint">How names in the model are understood.</p>
            {p.presets.dictionaries.map((d) => (
              <label key={d.id} className="option">
                <input
                  type="checkbox"
                  checked={p.settings.dictionaries.includes(d.id)}
                  onChange={() => p.onSettings({ ...p.settings, dictionaries: toggle(p.settings.dictionaries, d.id) })}
                />
                <span>
                  {d.name} <span className="muted">({d.layer} layer)</span>
                </span>
              </label>
            ))}
          </fieldset>
        </>
      )}

      {p.decisions.length > 0 && (
        <p className="small">
          {p.decisions.length} answer{p.decisions.length === 1 ? "" : "s"} applied to this model.{" "}
          <button className="link" onClick={p.onClearDecisions}>
            Clear
          </button>
        </p>
      )}

      <button className="primary" disabled={!m || !p.settings.ruleSet || p.running} onClick={p.onGenerate}>
        {p.running ? "Generating" : "Generate BoQ"}
      </button>
    </aside>
  );
}
