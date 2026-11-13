"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box as BoxIcon, EyeOff, Focus, Maximize, RotateCcw, X } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCoverage, useElementLines, useModelScenes, type SceneIndex } from "@/api/hooks/viewer";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { displayUnit } from "@/features/boq-sheet/model";
import { cn } from "@/lib/utils";
import { buildLinks, colorsFor, elementOfMesh, type ColorMode, type LegendEntry, type LinkLine } from "./links";
import type { Box, SceneView } from "./scene-view";

export interface ViewerModel {
  versionId: string;
  label: string;
  /** The id the run's traces use for this model (`trace.elements[].model`). */
  traceId?: string;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
const AXES = ["x", "y", "z"] as const;

/**
 * The 3D view (F07): every model of a run (or one model version) in one scene, a toggle per model,
 * colour modes, storey filter, section box, isolate and hide, and the panel of a picked element with
 * the lines it feeds. `focusLine` / `focusGuids` are the "Show in 3D" entry points (F07 §7).
 */
export function ModelViewer({
  models,
  runId,
  lines,
  systems = [],
  focusLine = null,
  focusGuids = null,
  onOpenLine,
  className,
}: {
  models: ViewerModel[];
  /** Without a run (the model version page) there are no lines and no coverage (F07 §7). */
  runId?: string;
  lines?: readonly (LinkLine & { description: string; unit: string })[];
  systems?: { id: string; name: string }[];
  focusLine?: string | null;
  focusGuids?: readonly string[] | null;
  onOpenLine?: (key: string) => void;
  className?: string;
}) {
  const t = useTranslations("viewer");
  const format = useFormatter();
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<SceneView | null>(null);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(new Set());
  const [counts, setCounts] = useState({ meshes: 0, visible: 0 });
  const [hiddenModels, setHiddenModels] = useState<ReadonlySet<string>>(new Set());
  const [mode, setMode] = useState<ColorMode>(runId ? "coverage" : "type");
  const [system, setSystem] = useState<string | undefined>(systems[0]?.id);
  const [storey, setStorey] = useState<string>("");
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  const [legendPick, setLegendPick] = useState<string | null>(null);
  const [section, setSection] = useState<{ bounds: Box; box: Box } | null>(null);

  const queries = useModelScenes(models.map((m) => m.versionId));
  const scenes = models.map((_, i) => queries[i * 2]?.data as SceneIndex | undefined);
  const glbs = models.map((_, i) => queries[i * 2 + 1]?.data as ArrayBuffer | undefined);
  const failed = models.filter((_, i) => queries[i * 2]?.isError || queries[i * 2 + 1]?.isError);
  const coverage = useCoverage(runId);

  // One element map for all models; which model each element is in (by our version id).
  // Scene data never changes once loaded, so which ones are in is what the memo depends on.
  const scenesIn = models.map((m, i) => (scenes[i] ? m.versionId : "")).join("|");
  const { elements, modelOf, storeys } = useMemo(() => {
    const elements: SceneIndex["elements"] = {};
    const modelOf = new Map<string, string>();
    scenes.forEach((s, i) => {
      if (!s) return;
      for (const [g, e] of Object.entries(s.elements)) {
        if (!elements[g]) elements[g] = e;
        if (!modelOf.has(g)) modelOf.set(g, models[i]!.versionId);
      }
    });
    const storeys = [...new Set(Object.values(elements).map((e) => e.storey).filter((s): s is string => !!s))].sort();
    return { elements, modelOf, storeys };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenesIn]);
  const links = useMemo(() => buildLinks(lines ?? [], elements), [lines, elements]);

  // The three.js view lives as long as the component; three is loaded on demand.
  useEffect(() => {
    let disposed = false;
    void import("./scene-view").then(({ SceneView }) => {
      if (disposed || !host.current) return;
      view.current = new SceneView(host.current);
      setReady(true);
    });
    return () => {
      disposed = true;
      view.current?.dispose();
      view.current = null;
    };
  }, []);

  // Each model is added once its scene and geometry are in (progressive, F07 §8).
  useEffect(() => {
    const v = view.current;
    if (!ready || !v) return;
    models.forEach((m, i) => {
      const scene = scenes[i];
      const glb = glbs[i];
      if (!scene || !glb || loaded.has(m.versionId)) return;
      setLoaded((s) => new Set(s).add(m.versionId));
      void v.load(m.versionId, glb, scene).then(() => setCounts({ meshes: v.meshCount, visible: v.visibleCount }));
    });
  });

  const legendInput = { mode, elements, links, coverage: coverage.data, system, modelOf: (g: string) => modelOf.get(g), models: models.map((m) => ({ id: m.versionId, label: m.label })) };
  const { colors, legend } = useMemo(() => colorsFor(legendInput), [mode, elements, links, coverage.data, system, modelOf, models]); // eslint-disable-line react-hooks/exhaustive-deps

  // What is shown strongly: a legend group, else the "Show in 3D" line or elements.
  const focusElements = useMemo(() => {
    if (legendPick !== null) return legend.find((l) => l.key === legendPick)?.guids ?? [];
    if (focusLine) return links.elementsOf(focusLine);
    return focusGuids ? [...focusGuids] : [];
  }, [legendPick, legend, focusLine, focusGuids, links]);
  const focusMeshes = useMemo(() => links.meshesOf(focusElements), [links, focusElements]);
  const pickedMeshes = useMemo(() => links.meshesOf(picked), [links, picked]);
  const allLoaded = loaded.size === models.length && models.length > 0;

  useEffect(() => {
    view.current?.paint({ colors, focus: focusMeshes, picked: pickedMeshes });
  }, [colors, focusMeshes, pickedMeshes, loaded]);

  // Frame what "Show in 3D" asked for, once everything is in.
  const framed = useRef<string>("");
  useEffect(() => {
    const v = view.current;
    const key = `${focusLine ?? ""}|${focusGuids?.join(",") ?? ""}`;
    if (!v || !allLoaded || framed.current === key) return;
    framed.current = key;
    if (focusMeshes.size) v.fit(focusMeshes);
  }, [allLoaded, focusLine, focusGuids, focusMeshes]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    v.onPick = (mesh, additive) => {
      const guid = mesh ? elementOfMesh(mesh, elements, links) : null;
      setPicked((s) => {
        if (!guid) return additive ? s : new Set();
        if (!additive) return new Set([guid]);
        const next = new Set(s);
        if (next.has(guid)) next.delete(guid);
        else next.add(guid);
        return next;
      });
    };
  }, [elements, links, ready]);

  const refresh = () => view.current && setCounts({ meshes: view.current.meshCount, visible: view.current.visibleCount });
  const selection = picked.size ? pickedMeshes : focusMeshes;
  const act = (fn: (v: SceneView) => void) => {
    if (!view.current) return;
    fn(view.current);
    refresh();
  };

  const toggleModel = (id: string) => {
    const off = !hiddenModels.has(id);
    setHiddenModels((s) => {
      const next = new Set(s);
      if (off) next.add(id);
      else next.delete(id);
      return next;
    });
    act((v) => v.setModelVisible(id, !off));
  };

  const toggleSection = () => {
    const v = view.current;
    if (!v) return;
    if (section) {
      v.setSection(null);
      setSection(null);
      return;
    }
    const bounds = v.bounds();
    if (!bounds) return;
    const box = (selection.size ? v.bounds(selection) : null) ?? bounds;
    const pad = (i: number) => (bounds.max[i]! - bounds.min[i]!) * 0.01;
    const grown: Box = { min: [box.min[0] - pad(0), box.min[1] - pad(1), box.min[2] - pad(2)], max: [box.max[0] + pad(0), box.max[1] + pad(1), box.max[2] + pad(2)] };
    v.setSection(grown);
    setSection({ bounds, box: grown });
  };
  const moveSection = (axis: number, end: "min" | "max", value: number) => {
    if (!section) return;
    const box: Box = { min: [...section.box.min], max: [...section.box.max] };
    box[end][axis] = value;
    view.current?.setSection(box);
    setSection({ ...section, box });
  };

  const single = picked.size === 1 ? [...picked][0]! : null;
  const pickedLines = useMemo(() => [...new Map([...picked].flatMap((g) => links.linesOf(g)).map((l) => [l.key, l])).values()], [picked, links]);
  const focusLineRow = focusLine ? lines?.find((l) => l.key === focusLine) : undefined;

  return (
    <div
      className={cn("flex min-h-[520px] flex-col gap-3 lg:flex-row", className)}
      data-testid="viewer"
      data-ready={allLoaded ? "true" : "false"}
      data-meshes={counts.meshes}
      data-visible={counts.visible}
      data-focus={focusMeshes.size}
      data-picked={picked.size}
    >
      <div className="relative min-h-[420px] flex-1 border border-border bg-muted/40">
        <div ref={host} className="absolute inset-0" data-testid="viewer-canvas" />
        {!allLoaded && (
          <p className="absolute left-3 top-3 text-muted-foreground" aria-busy="true">
            {models.filter((m) => !loaded.has(m.versionId)).map((m) => t("loading", { name: m.label })).join(" ")}
          </p>
        )}
        <div className="absolute right-2 top-2 flex gap-1">
          <Button variant="outline" size="icon" title={t("fit")} aria-label={t("fit")} onClick={() => view.current?.fit(selection.size ? selection : undefined)} data-testid="viewer-fit">
            <Maximize aria-hidden />
          </Button>
          <Button variant="outline" size="icon" title={t("isolate")} aria-label={t("isolate")} disabled={!selection.size} onClick={() => act((v) => v.isolate(selection))} data-testid="viewer-isolate">
            <Focus aria-hidden />
          </Button>
          <Button variant="outline" size="icon" title={t("hide")} aria-label={t("hide")} disabled={!picked.size} onClick={() => act((v) => (v.hide(pickedMeshes), setPicked(new Set())))} data-testid="viewer-hide">
            <EyeOff aria-hidden />
          </Button>
          <Button variant={section ? "default" : "outline"} size="icon" title={t("section")} aria-label={t("section")} aria-pressed={!!section} onClick={toggleSection} data-testid="viewer-section">
            <BoxIcon aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            title={t("showAll")}
            aria-label={t("showAll")}
            onClick={() => {
              setStorey("");
              setSection(null);
              act((v) => v.reset());
            }}
            data-testid="viewer-reset"
          >
            <RotateCcw aria-hidden />
          </Button>
        </div>
      </div>

      <aside className="flex w-full flex-col gap-4 lg:w-[320px] lg:shrink-0" data-testid="viewer-panel">
        <section className="flex flex-col gap-1">
          <h4 className="label-caps text-muted-foreground">{t("models")}</h4>
          {models.map((m) => (
            <label key={m.versionId} className="flex items-center gap-2" data-testid="viewer-model" data-loaded={loaded.has(m.versionId) ? "true" : "false"}>
              <input type="checkbox" checked={!hiddenModels.has(m.versionId)} onChange={() => toggleModel(m.versionId)} disabled={!loaded.has(m.versionId)} data-testid="viewer-model-toggle" />
              {mode === "model" && <span className="size-3 shrink-0" style={{ background: hex(legend.find((l) => l.key === m.versionId)?.color ?? 0xcccccc) }} aria-hidden />}
              <span className="min-w-0 flex-1 truncate" title={m.label}>
                {m.label}
              </span>
            </label>
          ))}
          {failed.map((m) => (
            <p key={m.versionId} role="alert" className="text-error">
              {t("failed", { name: m.label })}
            </p>
          ))}
          <p className="text-muted-foreground tabular-nums">{t("shown", { shown: counts.visible, total: counts.meshes })}</p>
        </section>

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1">
            <span className="label-caps text-muted-foreground">{t("colour")}</span>
            <NativeSelect
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as ColorMode);
                setLegendPick(null);
              }}
              data-testid="viewer-mode"
            >
              {(["type", ...(runId ? (["coverage", "code", "source"] as const) : []), ...(models.length > 1 ? (["model"] as const) : [])] as ColorMode[]).map((m) => (
                <option key={m} value={m}>
                  {t(`modes.${m}`)}
                </option>
              ))}
            </NativeSelect>
          </label>
          {mode === "code" && systems.length > 1 && (
            <label className="flex flex-col gap-1">
              <span className="label-caps text-muted-foreground">{t("system")}</span>
              <NativeSelect value={system} onChange={(e) => setSystem(e.target.value)} data-testid="viewer-system">
                {systems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
          {storeys.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className="label-caps text-muted-foreground">{t("storey")}</span>
              <NativeSelect
                value={storey}
                onChange={(e) => {
                  setStorey(e.target.value);
                  act((v) => v.setStorey(e.target.value || null));
                }}
                data-testid="viewer-storey"
              >
                <option value="">{t("allStoreys")}</option>
                {storeys.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
        </div>

        {legend.length > 0 && (
          <ul className="flex flex-col gap-0.5" data-testid="viewer-legend">
            {legend.map((l: LegendEntry) => (
              <li key={l.key}>
                <button
                  className={cn("flex w-full items-center gap-2 px-1 text-left hover:bg-accent", legendPick === l.key && "bg-selection")}
                  aria-pressed={legendPick === l.key}
                  onClick={() => setLegendPick((k) => (k === l.key ? null : l.key))}
                  data-testid="viewer-legend-entry"
                  data-key={l.key}
                  data-count={l.guids.length}
                >
                  <span className="size-3 shrink-0" style={{ background: hex(l.color) }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{l.translate ? t(`legend.${l.label}`) : l.label}</span>
                  <span className="tabular-nums text-muted-foreground">{format.number(l.guids.length)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {section && <SectionBox bounds={section.bounds} box={section.box} onMove={moveSection} />}

        {focusLineRow && !picked.size && (
          <section className="flex flex-col gap-1" data-testid="viewer-focus-line">
            <h4 className="label-caps text-muted-foreground">{t("line")}</h4>
            <p>{focusLineRow.description}</p>
            <p className="text-muted-foreground">{t("lineElements", { count: links.elementsOf(focusLineRow.key).length })}</p>
            <ul className="flex max-h-64 flex-col overflow-auto">
              {links.elementsOf(focusLineRow.key).map((g) => (
                <li key={g}>
                  <button className="w-full truncate text-left text-link hover:underline" title={g} onClick={() => setPicked(new Set([g]))} data-testid="viewer-line-element">
                    {elements[g]?.name ?? g}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {picked.size > 0 && (
          <section className="flex flex-col gap-2" data-testid="viewer-selection">
            <div className="flex items-center gap-2">
              <p className="flex-1">{t("picked", { elements: picked.size, lines: pickedLines.length })}</p>
              <Button variant="ghost" size="icon" aria-label={t("clearSelection")} title={t("clearSelection")} onClick={() => setPicked(new Set())}>
                <X aria-hidden />
              </Button>
            </div>
            {single ? (
              <ElementPanel runId={runId} guid={single} element={elements[single]} modelLabel={models.find((m) => m.versionId === modelOf.get(single))?.label} onOpenLine={onOpenLine} />
            ) : (
              <ul className="flex flex-col gap-0.5">
                {pickedLines.map((l) => (
                  <li key={l.key}>
                    <LineLink line={lines?.find((x) => x.key === l.key)} lineKey={l.key} onOpenLine={onOpenLine} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}

/** The section box's six faces as sliders within the model's bounds (F07 §6). */
function SectionBox({ bounds, box, onMove }: { bounds: Box; box: Box; onMove: (axis: number, end: "min" | "max", value: number) => void }) {
  const t = useTranslations("viewer");
  return (
    <fieldset className="flex flex-col gap-1" data-testid="viewer-section-box">
      <legend className="label-caps text-muted-foreground">{t("section")}</legend>
      {AXES.flatMap((axis, i) =>
        (["min", "max"] as const).map((end) => (
          <label key={axis + end} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-muted-foreground">{t(end === "min" ? "sectionFrom" : "sectionTo", { axis: t(`sectionAxes.${axis}`) })}</span>
            <input
              type="range"
              className="min-w-0 flex-1"
              min={bounds.min[i]}
              max={bounds.max[i]}
              step={(bounds.max[i]! - bounds.min[i]!) / 200 || 0.01}
              value={box[end][i]}
              onChange={(e) => onMove(i, end, Number(e.target.value))}
            />
          </label>
        )),
      )}
    </fieldset>
  );
}

function LineLink({ line, lineKey, onOpenLine, share }: { line?: { description: string; unit: string }; lineKey: string; onOpenLine?: (key: string) => void; share?: string }) {
  const label = line?.description ?? lineKey;
  return (
    <span className="flex gap-2">
      {onOpenLine ? (
        <button className="min-w-0 flex-1 text-left text-link hover:underline" onClick={() => onOpenLine(lineKey)} data-testid="viewer-open-line" data-key={lineKey}>
          {label}
        </button>
      ) : (
        <span className="min-w-0 flex-1">{label}</span>
      )}
      {share && <span className="shrink-0 tabular-nums text-muted-foreground">{share}</span>}
    </span>
  );
}

/** F07 §4: a picked element and the lines it contributes to, with its share. */
function ElementPanel({
  runId,
  guid,
  element,
  modelLabel,
  onOpenLine,
}: {
  runId?: string;
  guid: string;
  element?: SceneIndex["elements"][string];
  modelLabel?: string;
  onOpenLine?: (key: string) => void;
}) {
  const t = useTranslations("viewer.element");
  const format = useFormatter();
  const detail = useElementLines(runId, guid);
  const rows: [string, string | undefined][] = [
    [t("class"), element?.ifcClass ?? detail.data?.ifcClass],
    [t("name"), element?.name ?? detail.data?.name],
    [t("type"), element?.type ?? detail.data?.type],
    [t("storey"), element?.storey ?? detail.data?.storey],
    [t("model"), modelLabel],
    [t("status"), detail.data?.status ? t(`statuses.${detail.data.status}`) : undefined],
  ];
  return (
    <div className="flex flex-col gap-2" data-testid="viewer-element" data-guid={guid}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="min-w-0 break-words">{v}</dd>
            </div>
          ))}
        <dt className="text-muted-foreground">{t("globalId")}</dt>
        <dd className="font-mono">{guid}</dd>
      </dl>
      {runId && (
        <>
          <h4 className="label-caps text-muted-foreground">{t("lines")}</h4>
          {detail.data && detail.data.lines.length === 0 && <p className="text-muted-foreground">{t("noLines")}</p>}
          <ul className="flex flex-col gap-0.5" data-testid="viewer-element-lines">
            {detail.data?.lines.map((l) => (
              <li key={l.lineKey} data-testid="viewer-element-line" data-key={l.lineKey} data-share={l.quantity ?? ""}>
                <LineLink
                  line={{ description: l.description, unit: l.unit }}
                  lineKey={l.lineKey}
                  onOpenLine={onOpenLine}
                  share={l.quantity === null ? undefined : `${format.number(l.quantity, { maximumFractionDigits: 3 })} ${displayUnit(l.unit)}`}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
