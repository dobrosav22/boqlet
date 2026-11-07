import { DEPLOYED, MAX_UPLOAD_MB } from "../api";

export type Mode = "boq" | "library" | "guide";

/** Brand and the switch between producing a BoQ, editing the preset library and reading the guide. */
export function SideHead({ mode, onMode }: { mode: Mode; onMode: (m: Mode) => void }) {
  return (
    <>
      <div className="brand">
        <span className="brand-mark" aria-hidden />
        IFC to BoQ <span className="muted">{DEPLOYED ? "demo" : "dev build"}</span>
      </div>
      {DEPLOYED && (
        <p className="demo-note">
          Demo: IFC files up to {MAX_UPLOAD_MB} MB. Library saves and answers are temporary; download what you want to keep.
        </p>
      )}
      <div className="modes" role="tablist" aria-label="Workspace">
        {(
          [
            ["boq", "Bill of quantities"],
            ["library", "Library"],
            ["guide", "Guide"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "on" : ""} onClick={() => onMode(m)}>
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
