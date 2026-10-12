import { useEffect, useState } from "react";

/** Raw JSON of a draft: everything the forms do not cover can be edited here. */
export function JsonTab<T>({ value, onChange, note }: { value: T; onChange: (v: T) => void; note?: string }) {
  const text = JSON.stringify(value, null, 2);
  const [draft, setDraft] = useState(text);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDraft(text);
    setError(null);
  }, [text]);
  const dirty = draft !== text;
  const apply = () => {
    try {
      onChange(JSON.parse(draft) as T);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="json-tab">
      <p className="hint">{note ?? "The draft exactly as it would be saved. Edit and apply; the forms update from it."}</p>
      <textarea className="mono json-area" spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} rows={28} />
      <div className="json-actions">
        <button type="button" className="primary" disabled={!dirty} onClick={apply}>
          Apply JSON
        </button>
        <button type="button" className="ghost" disabled={!dirty} onClick={() => setDraft(text)}>
          Discard
        </button>
        {error && <span className="error">{error}</span>}
      </div>
    </div>
  );
}
