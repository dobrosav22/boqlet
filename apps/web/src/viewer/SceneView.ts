/**
 * Plain three.js view of the engine's geometry.glb (one mesh node per GlobalId), so what is shown
 * is exactly what the engine measured. React drives it through a few methods; it renders on demand.
 *
 * IFC is Z-up, glTF viewers are Y-up: the model is rotated once on load.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface Paint {
  /** Mesh guid -> colour (hex). Missing = the class colour. */
  colors?: Map<string, number>;
  /** When set, these meshes are shown strongly and everything else is ghosted. */
  focus?: Set<string>;
}

const CLASS_COLORS: Record<string, number> = {
  IfcWall: 0xd9d4cc, IfcSlab: 0xc9c2b4, IfcRoof: 0x8f8a84, IfcCovering: 0xeee9e0, IfcFooting: 0xb5aea3,
  IfcBeam: 0x7c8a96, IfcColumn: 0x7c8a96, IfcMember: 0xb08a63, IfcWindow: 0x9ec9e6, IfcDoor: 0xa47a52,
  IfcStair: 0xbfb6a8, IfcStairFlight: 0xbfb6a8, IfcRailing: 0x5c6670, IfcFurnishingElement: 0xc8b89a, IfcFurniture: 0xc8b89a,
};
const DEFAULT_COLOR = 0xcfcac2;
const FOCUS = 0x2742b8;
const GHOST = 0xc5ccd3;

export class SceneView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.05, 5000);
  private controls: OrbitControls;
  private root = new THREE.Group();
  private meshes = new Map<string, THREE.Mesh>();
  private classOf = new Map<string, string>();
  private spaces = new Set<string>();
  private openings = new Set<string>();
  private showSpaces = false;
  private observer: ResizeObserver;
  private down: { x: number; y: number } | null = null;
  private frame = 0;
  onPick: (guid: string | null) => void = () => undefined;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xf2f6f2);
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
    el.addEventListener("pointerdown", (e) => (this.down = { x: e.clientX, y: e.clientY }));
    el.addEventListener("pointerup", (e) => {
      if (this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) < 5) this.pick(e);
      this.down = null;
    });
    this.resize();
  }

  /** Load geometry.glb; `classes` gives each element's IFC class for default colours. */
  async load(url: string, classes: Map<string, string>, spaces: string[], openings: string[]) {
    this.classOf = classes;
    this.spaces = new Set(spaces);
    this.openings = new Set(openings);
    const gltf = await new GLTFLoader().loadAsync(url);
    gltf.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const guid = o.name || o.parent?.name || "";
      o.name = guid;
      o.geometry.computeVertexNormals();
      o.material = new THREE.MeshStandardMaterial({ color: this.baseColor(guid), roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 35), new THREE.LineBasicMaterial({ color: 0x55606a, transparent: true, opacity: 0.35 }));
      edges.name = "edges";
      o.add(edges);
      this.meshes.set(guid, o);
    });
    this.root.add(gltf.scene);
    this.applyVisibility();
    this.fit();
  }

  private baseColor(guid: string) {
    return CLASS_COLORS[this.classOf.get(guid) ?? ""] ?? DEFAULT_COLOR;
  }

  private applyVisibility() {
    for (const [guid, m] of this.meshes) {
      if (this.openings.has(guid)) m.visible = false;
      else if (this.spaces.has(guid)) {
        m.visible = this.showSpaces;
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.color.set(0x8fb3e0);
        mat.transparent = true;
        mat.opacity = 0.18;
        mat.depthWrite = false;
        m.children.forEach((c) => (c.visible = false));
      }
    }
  }

  setShowSpaces(on: boolean) {
    this.showSpaces = on;
    this.applyVisibility();
    this.render();
  }

  paint({ colors, focus }: Paint) {
    for (const [guid, m] of this.meshes) {
      if (this.spaces.has(guid) || this.openings.has(guid)) continue;
      const mat = m.material as THREE.MeshStandardMaterial;
      const edges = m.getObjectByName("edges") as THREE.LineSegments | undefined;
      const ghost = !!focus && focus.size > 0 && !focus.has(guid);
      mat.color.set(focus?.has(guid) ? FOCUS : ghost ? GHOST : colors?.get(guid) ?? this.baseColor(guid));
      mat.transparent = ghost;
      mat.opacity = ghost ? 0.12 : 1;
      mat.depthWrite = !ghost;
      if (edges) edges.visible = !ghost;
    }
    this.render();
  }

  /** Frame these meshes (all when empty). */
  fit(guids?: Iterable<string>) {
    this.root.updateMatrixWorld(true); // the Z-up -> Y-up rotation must be applied before measuring
    const box = new THREE.Box3();
    const list = guids ? [...guids].map((g) => this.meshes.get(g)).filter((m): m is THREE.Mesh => !!m) : [];
    for (const m of list.length ? list : [...this.meshes.entries()].filter(([g]) => !this.spaces.has(g) && !this.openings.has(g)).map(([, m]) => m)) box.expandByObject(m);
    if (box.isEmpty()) return;
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
    // prefer what is shown strongly; faded (ghosted) elements are still clickable when nothing else is hit
    const hits = ray.intersectObjects(targets, false);
    const solid = hits.find((h) => !((h.object as THREE.Mesh).material as THREE.Material).transparent);
    const hit = solid ?? hits[0];
    this.onPick(hit ? hit.object.name : null);
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
