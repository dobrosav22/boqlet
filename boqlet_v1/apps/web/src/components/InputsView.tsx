import { useEffect, useState } from "react";
import type { BoqResult, PresetsResponse } from "@ifc-boq/types";
import { api } from "../api";
import type { Settings } from "./Sidebar";

/**
 * Shows the inputs of the run as data: the rule set as written (before flattening),
 * the resolved parameter values actually used, and the classification code list + map.
 * Edit the files in /presets to change them; the engine reloads them on every run.
 */
export function InputsView({ result, settings, presets }: { result: BoqResult; settings: Settings; presets: PresetsResponse | null }) {
  const [raw, setRaw] = useState<Record<string, unknown>>({});
  useEffect(() => {
    const want: [string, "rules" | "classifications", string][] = [
      [`rules:${result.ruleSet.id}`, "rules", result.ruleSet.id],
      ...settings.classifications.map((c) => [`classifications:${c}`, "classifications", c] as [string, "classifications", string]),
    ];
    for (const [key, kind, id] of want) {
      if (raw[key]) continue;
      api.preset(kind, id).then((d) => setRaw((x) => ({ ...x, [key]: d }))).catch(() => undefined);
    }
  }, [result.ruleSet.id, settings.classifications, raw]);

  const params = Object.entries(result.ruleSet.params);
  const rsInfo = presets?.ruleSets.find((r) => r.id === result.ruleSet.id);

  return (
    <div className="inputs">
      <section>
        <h2>Rules: {result.ruleSet.name}</h2>
        {rsInfo?.description && <p>{rsInfo.description}</p>}
        <p className="muted small">
          Chain: {result.ruleSet.meta.chain}. File: <code>presets/rules/{result.ruleSet.id}.json</code>
        </p>
        <h3>Parameter values used (slots)</h3>
        <table className="contrib">
          <thead>
            <tr>
              <th>Slot</th>
              <th>Value</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            {params.map(([k, p]) => (
              <tr key={k}>
                <td>
                  <code>{k}</code>
                </td>
                <td>
                  {JSON.stringify(p.value)} {"unit" in p && p.unit ? p.unit : ""}
                  {p.type === "choice" && <span className="muted"> of {p.options.join(" | ")}</span>}
                </td>
                <td>{p.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <details>
          <summary>Rule set as written ({result.ruleSet.items.length} item rules after flattening)</summary>
          <pre>{JSON.stringify(raw[`rules:${result.ruleSet.id}`] ?? "loading", null, 2)}</pre>
        </details>
      </section>
      {settings.classifications.map((c) => {
        const d = raw[`classifications:${c}`] as { codeList?: { name: string; codes: unknown[] }; map?: { rules: unknown[] } } | undefined;
        return (
          <section key={c}>
            <h2>Classification: {d?.codeList?.name ?? c}</h2>
            <p className="muted small">
              Files: <code>presets/classifications/{c}/codelist.json</code> and <code>map.json</code>.{" "}
              {d && `${d.codeList?.codes.length ?? 0} codes, ${d.map?.rules.length ?? 0} map rules.`}
            </p>
            <details>
              <summary>Map (which lines get which code)</summary>
              <pre>{JSON.stringify(d?.map ?? "loading", null, 2)}</pre>
            </details>
            <details>
              <summary>Code list</summary>
              <pre>{JSON.stringify(d?.codeList ?? "loading", null, 2)}</pre>
            </details>
          </section>
        );
      })}
      <section>
        <h2>Dictionaries</h2>
        <p>{settings.dictionaries.join(", ") || "none"}</p>
      </section>
    </div>
  );
}
