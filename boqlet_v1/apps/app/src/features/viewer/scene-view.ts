/**
 * Plain three.js view of the engine's geometry.glb files (one mesh node per GlobalId), so what is
 * shown is exactly what the engine measured (F07, ported from the PoC's `SceneView.ts`). React drives
 * it through a few methods; it renders on demand. Several models share one scene, each in its own
 * group so it can be toggled (F07 §2).
 *
 * IFC is Z-up, glTF viewers are Y-up: the models are rotated once on load.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { SceneIndex } from "@/api/hooks/viewer";

export interface Paint {
  /** Mesh guid -> colour (hex). Missing = the class colour. */
  colors?: Map<string, number>;
  /** When set, these meshes are shown strongly and everything else is ghosted. */
  focus?: ReadonlySet<string>;
  /** The picked elements' meshes, drawn in the selection colour. */
  picked?: ReadonlySet<string>;
  /** When set, only these meshes are in scope (the shared filter, F07 §9): the rest is ghosted. */
  scope?: ReadonlySet<string> | null;
}

export interface Box {
  min: [number, number, number];
  max: [number, number, number];
}

const CLASS_COLORS: Record<string, number> = {
  IfcWall: 0xd9d4cc, IfcSlab: 0xc9c2b4, IfcRoof: 0x8f8a84, IfcCovering: 0xeee9e0, IfcFooting: 0xb5aea3,
  IfcBeam: 0x7c8a96, IfcColumn: 0x7c8a96, IfcMember: 0xb08a63, IfcWindow: 0x9ec9e6, IfcDoor: 0xa47a52,
  IfcStair: 0xbfb6a8, IfcStairFlight: 0xbfb6a8, IfcRailing: 0x5c6670, IfcFurnishingElement: 0xc8b89a, IfcFurniture: 0xc8b89a,
};
const DEFAULT_COLOR = 0xcfcac2;
const FOCUS = 0x1e4fb8;
const PICKED = 0xe8590c;
const GHOST = 0xc5ccd3;

export class SceneView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.05, 5000);
  private controls: OrbitControls;
  private root = new THREE.Group();
  private groups = new Map<string, THREE.Group>();
  private meshes = new Map<string, THREE.Mesh>();
  private modelOf = new Map<string, string>();
  private classOf = new Map<string, string>();
  private storeyOf = new Map<string, string>();
  private spaces = new Set<string>();
  private openings = new Set<string>();
  private hiddenModels = new Set<string>();
  private hidden = new Set<string>();
  private isolated: Set<string> | null = null;
  private storey: string | null = null;
  private observer: ResizeObserver;
  private down: { x: number; y: number } | null = null;
  private frame = 0;
  private band: { x: number; y: number; el: HTMLDivElement } | null = null;
  onPick: (guid: string | null, additive: boolean) => void = () => undefined;
  /** Shift-drag selects every visible element whose centre is inside the box (F07 §9). */
  onBoxPick: (guids: string[]) => void = () => undefined;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xf2f0ea);
    this.renderer.localClippingEnabled = true;
    host.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.addEventListener("change", () => this.render());
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f94, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(30, 50, 20);
    this.scene.add(sun);
    this.root.rotation.x = -Math.PI / 2;
    this.scene.add(this.root);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", (e) => {
      this.down = { x: e.clientX, y: e.clientY };
      if (e.shiftKey && e.button === 0) {
        // Box selection instead of panning.
        this.controls.enabled = false;
        const band = document.createElement("div");
        band.style.cssText = "position:absolute;border:1px solid #1e4fb8;background:rgba(30,79,184,.12);pointer-events:none;";
        band.dataset.testid = "viewer-box";
        host.appendChild(band);
        this.band = { x: e.clientX, y: e.clientY, el: band };
        this.moveBand(e);
      }
    });
    el.addEventListener("pointermove", (e) => this.band && this.moveBand(e));
    el.addEventListener("pointerup", (e) => {
      const moved = this.down ? Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) : 0;
      if (this.band) {
        const { x, y, el: band } = this.band;
        band.remove();
        this.band = null;
        this.controls.enabled = true;
        if (moved >= 5) this.onBoxPick(this.inBox(x, y, e.clientX, e.clientY));
        else this.pick(e);
      } else if (this.down && moved < 5) this.pick(e);
      this.down = null;
    });
    this.resize();
  }

  /** Adds one model's geometry.glb; `scene` gives each mesh's class and storey. */
  async load(model: string, glb: ArrayBuffer, scene: SceneIndex) {
    const elements = scene.elements;
    const storeyOf = (guid: string) => {
      for (let g: string | undefined = guid, n = 0; g && n < 10; g = elements[g]?.parent, n++) if (elements[g]?.storey) return elements[g]!.storey;
      return undefined;
    };
    scene.spaces.forEach((g) => this.spaces.add(g));
    scene.openings.forEach((g) => this.openings.add(g));
    const gltf = await new GLTFLoader().parseAsync(glb.slice(0), "");
    const group = new THREE.Group();
    group.name = model;
    gltf.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const guid = o.name || o.parent?.name || "";
      o.name = guid;
      o.geometry.computeVertexNormals();
      this.modelOf.set(guid, model);
      const cls = elements[guid]?.ifcClass;
      if (cls) this.classOf.set(guid, cls);
      const storey = storeyOf(guid);
      if (storey) this.storeyOf.set(guid, storey);
      o.material = new THREE.MeshStandardMaterial({ color: this.baseColor(guid), roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 35), new THREE.LineBasicMaterial({ color: 0x55606a, transparent: true, opacity: 0.35 }));
      edges.name = "edges";
      o.add(edges);
      this.meshes.set(guid, o);
    });
    group.add(gltf.scene);
    this.groups.set(model, group);
    this.root.add(group);
    this.applyVisibility();
    this.fit();
  }

  /** Meshes drawn (elements; spaces and openings excluded). */
  get meshCount() {
    let n = 0;
    for (const g of this.meshes.keys()) if (!this.spaces.has(g) && !this.openings.has(g)) n++;
    return n;
  }

  /** Meshes drawn now (after model toggles, storey, hide, isolate). */
  get visibleCount() {
    let n = 0;
    for (const [g, m] of this.meshes) if (m.visible && !this.spaces.has(g)) n++;
    return n;
  }

  private baseColor(guid: string) {
    return CLASS_COLORS[this.classOf.get(guid) ?? ""] ?? DEFAULT_COLOR;
  }

  private applyVisibility() {
    for (const [guid, m] of this.meshes) {
      const model = this.modelOf.get(guid) ?? "";
      let visible = !this.openings.has(guid) && !this.spaces.has(guid) && !this.hiddenModels.has(model);
      if (visible && this.storey) visible = this.storeyOf.get(guid) === this.storey;
      if (visible && this.hidden.has(guid)) visible = false;
      if (visible && this.isolated) visible = this.isolated.has(guid);
      m.visible = visible;
    }
    this.render();
  }

  setModelVisible(model: string, on: boolean) {
    if (on) this.hiddenModels.delete(model);
    else this.hiddenModels.add(model);
    this.applyVisibility();
  }

  /** Show one storey only (F07 §6); null shows all. */
  setStorey(storey: string | null) {
    this.storey = storey;
    this.applyVisibility();
  }

  hide(guids: Iterable<string>) {
    for (const g of guids) this.hidden.add(g);
    this.applyVisibility();
  }

  isolate(guids: Iterable<string> | null) {
    this.isolated = guids ? new Set(guids) : null;
    this.applyVisibility();
  }

  /** Shows everything again: hidden elements, isolation, storey filter (model toggles stay). */
  reset() {
    this.hidden.clear();
    this.isolated = null;
    this.storey = null;
    this.setSection(null);
    this.applyVisibility();
    this.fit();
  }

  paint({ colors, focus, picked, scope }: Paint) {
    for (const [guid, m] of this.meshes) {
      if (this.spaces.has(guid) || this.openings.has(guid)) continue;
      const mat = m.material as THREE.MeshStandardMaterial;
      const edges = m.getObjectByName("edges") as THREE.LineSegments | undefined;
      const strong = picked?.has(guid) || focus?.has(guid);
      const ghost = !strong && ((!!focus && focus.size > 0) || (!!picked && picked.size > 0 && !focus) || (!!scope && !scope.has(guid)));
      mat.color.set(picked?.has(guid) ? PICKED : focus?.has(guid) ? FOCUS : ghost ? GHOST : (colors?.get(guid) ?? this.baseColor(guid)));
      mat.transparent = ghost;
      mat.opacity = ghost ? 0.12 : 1;
      mat.depthWrite = !ghost;
      if (edges) edges.visible = !ghost;
    }
    this.render();
  }

  /** The world-space box of these meshes (all visible ones when empty), Y-up. */
  bounds(guids?: Iterable<string>): Box | null {
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const list = guids ? [...guids].map((g) => this.meshes.get(g)).filter((m): m is THREE.Mesh => !!m) : [];
    for (const m of list.length ? list : [...this.meshes.entries()].filter(([g, m]) => m.visible && !this.spaces.has(g)).map(([, m]) => m)) box.expandByObject(m);
    if (box.isEmpty()) return null;
    return { min: box.min.toArray(), max: box.max.toArray() };
  }

  /** One axis-aligned section box (F07 §6); null removes it. */
  setSection(box: Box | null) {
    this.renderer.clippingPlanes = box
      ? [
          new THREE.Plane(new THREE.Vector3(1, 0, 0), -box.min[0]),
          new THREE.Plane(new THREE.Vector3(-1, 0, 0), box.max[0]),
          new THREE.Plane(new THREE.Vector3(0, 1, 0), -box.min[1]),
          new THREE.Plane(new THREE.Vector3(0, -1, 0), box.max[1]),
          new THREE.Plane(new THREE.Vector3(0, 0, 1), -box.min[2]),
          new THREE.Plane(new THREE.Vector3(0, 0, -1), box.max[2]),
        ]
      : [];
    this.render();
  }

  /** Frame these meshes (all visible ones when empty). */
  fit(guids?: Iterable<string>) {
    const b = this.bounds(guids);
    if (!b) return;
    const box = new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max));
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    const dir = new THREE.Vector3(1, 0.8, 1.2).normalize();
    this.camera.position.copy(center).addScaledVector(dir, Math.max(size, 2) * 1.3);
    this.camera.near = Math.max(size / 1000, 0.01);
    this.camera.far = size * 20 + 100;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.controls.update();
    this.render();
  }

  private pick(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const targets = [...this.meshes.entries()].filter(([g, m]) => m.visible && !this.spaces.has(g)).map(([, m]) => m);
    // Prefer what is shown strongly; ghosted elements are still clickable when nothing else is hit.
    const hits = ray.intersectObjects(targets, false);
    const solid = hits.find((h) => !((h.object as THREE.Mesh).material as THREE.Material).transparent);
    const hit = solid ?? hits[0];
    this.onPick(hit ? hit.object.name : null, e.shiftKey || e.ctrlKey || e.metaKey);
  }

  private moveBand(e: PointerEvent) {
    if (!this.band) return;
    const r = this.host.getBoundingClientRect();
    const [x0, x1] = [Math.min(this.band.x, e.clientX), Math.max(this.band.x, e.clientX)];
    const [y0, y1] = [Math.min(this.band.y, e.clientY), Math.max(this.band.y, e.clientY)];
    Object.assign(this.band.el.style, { left: `${x0 - r.left}px`, top: `${y0 - r.top}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
  }

  /** Visible meshes whose bounding-box centre projects inside the screen rectangle. */
  private inBox(ax: number, ay: number, bx: number, by: number): string[] {
    const r = this.renderer.domElement.getBoundingClientRect();
    const [x0, x1] = [Math.min(ax, bx), Math.max(ax, bx)];
    const [y0, y1] = [Math.min(ay, by), Math.max(ay, by)];
    this.root.updateMatrixWorld(true);
    const out: string[] = [];
    const box = new THREE.Box3();
    const c = new THREE.Vector3();
    for (const [guid, m] of this.meshes) {
      if (!m.visible || this.spaces.has(guid)) continue;
      box.setFromObject(m).getCenter(c).project(this.camera);
      if (c.z > 1) continue;
      const px = r.left + ((c.x + 1) / 2) * r.width;
      const py = r.top + ((1 - c.y) / 2) * r.height;
      if (px >= x0 && px <= x1 && py >= y0 && py <= y1) out.push(guid);
    }
    return out;
  }

  private resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  private render() {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.renderer.render(this.scene, this.camera));
  }

  dispose() {
    this.observer.disconnect();
    cancelAnimationFrame(this.frame);
    this.controls.dispose();
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
