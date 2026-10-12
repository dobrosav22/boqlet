export type Mode = "boq" | "library";

/** Brand and the switch between producing a BoQ and editing the preset library. */
export function SideHead({ mode, onMode }: { mode: Mode; onMode: (m: Mode) => void }) {
  return (
    <>
      <div className="brand">
        <span className="brand-mark" aria-hidden />
        IFC to BoQ <span className="muted">dev build</span>
      </div>
      <div className="modes" role="tablist" aria-label="Workspace">
        {(
          [
            ["boq", "Bill of quantities"],
            ["library", "Library"],
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
