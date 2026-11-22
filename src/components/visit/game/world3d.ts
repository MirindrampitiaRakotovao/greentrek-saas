import * as THREE from "three";

import { SATELLITE_TILES, TERRAIN_TILES } from "@/lib/map3d/style";
import type { Ambiance } from "@/lib/visit/route";
import {
  DEM_ZOOM,
  decodeTerrarium,
  isVegetation,
  localProjection,
  SAT_ZOOM,
  tileCorner,
  tileXY,
} from "@/lib/visit/world";

import { makeFlora } from "./models";

/**
 * Monde 3D de la visite « mode jeu » (étape 8b) : sol RÉEL (relief Mapzen + image satellite
 * Esri) chargé par tuiles autour du randonneur, forêts posées là où l'image satellite montre
 * de la végétation, mer au niveau zéro, ciel et lumière selon l'ambiance.
 */

export type Quality = { treesPerChunk: number; grass: number; shadows: number; radius: number };
export const QUALITY_DESKTOP: Quality = {
  treesPerChunk: 1600,
  grass: 7000,
  shadows: 2048,
  radius: 1,
};
export const QUALITY_MOBILE: Quality = {
  treesPerChunk: 450,
  grass: 1500,
  shadows: 1024,
  radius: 1,
};

const SUB = 2 ** (SAT_ZOOM - DEM_ZOOM); // tuiles satellite par côté de tuile de relief
const GRID = 128; // sommets par côté (relief sous-échantillonné)

type Chunk = {
  key: string;
  heights: Float32Array | null;
  group: THREE.Group;
  disposed: boolean;
};

const LOOKS: Record<
  Ambiance,
  {
    top: string;
    bottom: string;
    fog: string;
    sun: string;
    sunI: number;
    hemi: number;
    exposure: number;
    sunDir: [number, number, number];
    water: string;
  }
> = {
  aube: {
    top: "#6c7fbf",
    bottom: "#f4b9a0",
    fog: "#efc4b0",
    sun: "#ffd0a8",
    sunI: 2.2,
    hemi: 0.7,
    exposure: 1,
    sunDir: [-0.8, 0.35, 0.3],
    water: "#3f8aa0",
  },
  jour: {
    top: "#4f8fc4",
    bottom: "#e4efe9",
    fog: "#d4e4dc",
    sun: "#fff0d2",
    sunI: 3.1,
    hemi: 0.95,
    exposure: 1.05,
    sunDir: [-0.5, 0.85, -0.35],
    water: "#2b8c9a",
  },
  crepuscule: {
    top: "#2c2f63",
    bottom: "#ff9e5e",
    fog: "#d98a63",
    sun: "#ffb36b",
    sunI: 2.1,
    hemi: 0.55,
    exposure: 0.95,
    sunDir: [0.9, 0.2, 0.4],
    water: "#5a6e8a",
  },
  nuit: {
    top: "#03060f",
    bottom: "#1b2d4a",
    fog: "#0e1a2e",
    sun: "#9fb4ff",
    sunI: 0.35,
    hemi: 0.16,
    exposure: 0.9,
    sunDir: [0.3, 0.8, 0.2],
    water: "#14304a",
  },
};

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const tileUrl = (template: string, z: number, x: number, y: number) =>
  template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));

export class World {
  readonly projection: ReturnType<typeof localProjection>;
  private chunks = new Map<string, Chunk>();
  private flora = makeFlora();
  private sky: THREE.Mesh;
  private skyUniforms: { top: { value: THREE.Color }; bottom: { value: THREE.Color } };
  private hemi: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
  private water: THREE.Mesh;
  private waterMaterial: THREE.MeshStandardMaterial;
  private grass: THREE.InstancedMesh;
  private grassCenter = new THREE.Vector3(Infinity, 0, Infinity);
  private seed = 11;
  private stars: THREE.Points;

  constructor(
    private scene: THREE.Scene,
    private renderer: THREE.WebGLRenderer,
    origin: { lat: number; lng: number },
    private quality: Quality,
    /** Distance (m) au sentier : la forêt et l'herbe le laissent dégagé. */
    private clearance: (x: number, z: number) => number,
    /** Points du sentier (repère local) : la forêt est plus dense à ses abords. */
    private routeSamples: readonly [number, number][] = [],
  ) {
    this.projection = localProjection(origin.lat, origin.lng);

    this.skyUniforms = { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(4000, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: this.skyUniforms,
        vertexShader:
          "varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader:
          "uniform vec3 top; uniform vec3 bottom; varying vec3 p; void main(){ float t = smoothstep(-0.05, 0.55, p.y); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }",
      }),
    );
    scene.add(this.sky);

    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const a = this.rand() * Math.PI * 2;
      const e = 0.15 + this.rand() * 1.3;
      starPos.set(
        [Math.cos(a) * Math.cos(e) * 3500, Math.sin(e) * 3500, Math.sin(a) * Math.cos(e) * 3500],
        i * 3,
      );
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: "#ffffff", size: 4, sizeAttenuation: false, fog: false }),
    );
    scene.add(this.stars);

    this.hemi = new THREE.HemisphereLight("#cfe8ff", "#3d5a2a", 1);
    this.sun = new THREE.DirectionalLight("#ffffff", 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(quality.shadows, quality.shadows);
    Object.assign(this.sun.shadow.camera, {
      left: -45,
      right: 45,
      top: 45,
      bottom: -45,
      near: 1,
      far: 400,
    });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.hemi, this.sun, this.sun.target);

    this.waterMaterial = new THREE.MeshStandardMaterial({
      color: "#2b8c9a",
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.88,
    });
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2),
      this.waterMaterial,
    );
    this.water.position.y = 0.4;
    this.water.receiveShadow = true;
    scene.add(this.water);

    const blade = new THREE.ConeGeometry(0.05, 0.75, 3).translate(0, 0.37, 0);
    this.grass = new THREE.InstancedMesh(
      blade,
      new THREE.MeshStandardMaterial({ color: "#5d8f31", roughness: 0.9 }),
      quality.grass,
    );
    this.grass.count = 0;
    this.grass.receiveShadow = true;
    scene.add(this.grass);
  }

  private rand() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  setAmbiance(value: Ambiance) {
    const look = LOOKS[value];
    this.skyUniforms.top.value.set(look.top);
    this.skyUniforms.bottom.value.set(look.bottom);
    this.scene.fog = new THREE.Fog(look.fog, 50, value === "nuit" ? 320 : 900);
    this.hemi.intensity = look.hemi;
    this.sun.color.set(look.sun);
    this.sun.intensity = look.sunI;
    this.renderer.toneMappingExposure = look.exposure;
    this.waterMaterial.color.set(look.water);
    (this.stars.material as THREE.PointsMaterial).opacity = value === "nuit" ? 1 : 0;
    this.stars.visible = value === "nuit";
    this.sunDir.set(...look.sunDir).normalize();
  }
  private sunDir = new THREE.Vector3(-0.5, 0.85, -0.35).normalize();

  /** Altitude (m) du relief réel au point local (x, z) ; 0 si la tuile n'est pas chargée. */
  heightAt(x: number, z: number): number {
    const [lat, lng] = this.projection.toLatLng(x, z);
    const [tx, ty] = tileXY(lat, lng, DEM_ZOOM);
    const chunk = this.chunks.get(`${Math.floor(tx)},${Math.floor(ty)}`);
    if (!chunk?.heights) return 0;
    const gx = Math.min(254.999, Math.max(0, (tx - Math.floor(tx)) * 255));
    const gy = Math.min(254.999, Math.max(0, (ty - Math.floor(ty)) * 255));
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    const h = chunk.heights;
    const at = (a: number, b: number) => h[b * 256 + a]!;
    return (
      (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) +
      (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy
    );
  }

  /** Charge les tuiles autour du point (et libère les plus lointaines). */
  ensureAround(x: number, z: number) {
    const [lat, lng] = this.projection.toLatLng(x, z);
    const [tx, ty] = tileXY(lat, lng, DEM_ZOOM).map(Math.floor) as [number, number];
    const r = this.quality.radius;
    const wanted = new Set<string>();
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const key = `${tx + dx},${ty + dy}`;
        wanted.add(key);
        if (!this.chunks.has(key)) void this.load(tx + dx, ty + dy);
      }
    }
    for (const [key, chunk] of this.chunks) {
      const [cx, cy] = key.split(",").map(Number) as [number, number];
      if (Math.max(Math.abs(cx - tx), Math.abs(cy - ty)) > r + 1) this.dispose(chunk);
    }
    return wanted;
  }

  /** Tuiles du voisinage déjà prêtes (pour l'écran de chargement). */
  readyCount() {
    let n = 0;
    for (const c of this.chunks.values()) if (c.heights) n++;
    return n;
  }

  private dispose(chunk: Chunk) {
    chunk.disposed = true;
    this.scene.remove(chunk.group);
    chunk.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !(mesh as THREE.InstancedMesh).isInstancedMesh) {
        mesh.geometry.dispose();
        const m = mesh.material as THREE.MeshStandardMaterial;
        m.map?.dispose();
        m.dispose();
      }
    });
    this.chunks.delete(chunk.key);
  }

  private async load(tx: number, ty: number) {
    const key = `${tx},${ty}`;
    const chunk: Chunk = { key, heights: null, group: new THREE.Group(), disposed: false };
    this.chunks.set(key, chunk);

    const [dem, ...sats] = await Promise.all([
      loadImage(tileUrl(TERRAIN_TILES, DEM_ZOOM, tx, ty)),
      ...Array.from({ length: SUB * SUB }, (_, k) =>
        loadImage(
          tileUrl(SATELLITE_TILES, SAT_ZOOM, tx * SUB + (k % SUB), ty * SUB + Math.floor(k / SUB)),
        ),
      ),
    ]);
    if (chunk.disposed) return;

    // Relief.
    const heights = new Float32Array(256 * 256);
    if (dem) {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(dem, 0, 0);
      const d = ctx.getImageData(0, 0, 256, 256).data;
      for (let i = 0; i < 256 * 256; i++)
        heights[i] = Math.max(-3, decodeTerrarium(d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!));
    }
    chunk.heights = heights;

    // Image satellite (mosaïque).
    const size = 256 * SUB;
    const sat = document.createElement("canvas");
    sat.width = sat.height = size;
    const sctx = sat.getContext("2d", { willReadFrequently: true })!;
    sctx.fillStyle = "#4a6b3a";
    sctx.fillRect(0, 0, size, size);
    sats.forEach(
      (img, k) => img && sctx.drawImage(img, (k % SUB) * 256, Math.floor(k / SUB) * 256),
    );
    const pixels = sctx.getImageData(0, 0, size, size).data;

    // Maillage : sommets aux positions réelles (lat/lng → repère local).
    const corner0 = tileCorner(tx, ty, DEM_ZOOM);
    const corner1 = tileCorner(tx + 1, ty + 1, DEM_ZOOM);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array((GRID + 1) * (GRID + 1) * 3);
    const uvs = new Float32Array((GRID + 1) * (GRID + 1) * 2);
    for (let j = 0; j <= GRID; j++) {
      for (let i = 0; i <= GRID; i++) {
        const u = i / GRID;
        const v = j / GRID;
        const { lat } = tileCorner(tx, ty + v, DEM_ZOOM);
        const lng = corner0.lng + (corner1.lng - corner0.lng) * u;
        const [x, z] = this.projection.toLocal(lat, lng);
        const hx = Math.min(255, Math.round(u * 255));
        const hy = Math.min(255, Math.round(v * 255));
        const k = j * (GRID + 1) + i;
        positions.set([x, heights[hy * 256 + hx]!, z], k * 3);
        uvs.set([u, 1 - v], k * 2);
      }
    }
    const index: number[] = [];
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const a = j * (GRID + 1) + i;
        index.push(a, a + GRID + 1, a + 1, a + 1, a + GRID + 1, a + GRID + 2);
      }
    }
    geometry.setIndex(index);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    const texture = new THREE.CanvasTexture(sat);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const ground = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }),
    );
    ground.receiveShadow = true;
    chunk.group.add(ground);

    // Forêt : seulement là où l'image satellite montre de la végétation, hors sentier.
    const spots: [number, number, number][][] = this.flora.trees.map(() => []);
    const bushes: [number, number, number][] = [];
    let placed = 0;
    for (
      let tries = 0;
      tries < this.quality.treesPerChunk * 14 && placed < this.quality.treesPerChunk;
      tries++
    ) {
      // Une fois sur deux, un point aux abords du sentier (8 à 120 m), sinon n'importe où.
      let u = this.rand();
      let v = this.rand();
      if (this.routeSamples.length > 0 && this.rand() < 0.55) {
        const [rx, rz] = this.routeSamples[Math.floor(this.rand() * this.routeSamples.length)]!;
        const a = this.rand() * Math.PI * 2;
        const d = 8 + this.rand() * 112;
        const [lat, lng] = this.projection.toLatLng(rx + Math.cos(a) * d, rz + Math.sin(a) * d);
        const [fx, fy] = tileXY(lat, lng, DEM_ZOOM);
        if (Math.floor(fx) !== tx || Math.floor(fy) !== ty) continue;
        u = fx - tx;
        v = fy - ty;
      }
      const px = Math.floor(u * (size - 1));
      const py = Math.floor(v * (size - 1));
      const p = (py * size + px) * 4;
      if (!isVegetation(pixels[p]!, pixels[p + 1]!, pixels[p + 2]!)) continue;
      const h =
        heights[Math.min(255, Math.round(v * 255)) * 256 + Math.min(255, Math.round(u * 255))]!;
      if (h < 1.5) continue;
      const { lat } = tileCorner(tx, ty + v, DEM_ZOOM);
      const [x, z] = this.projection.toLocal(lat, corner0.lng + (corner1.lng - corner0.lng) * u);
      if (this.clearance(x, z) < 6) continue;
      if (this.rand() < 0.2) {
        bushes.push([x, h, z]);
        continue;
      }
      let pick = this.rand();
      let kind = 0;
      while (kind < this.flora.trees.length - 1 && pick > this.flora.trees[kind]!.weight) {
        pick -= this.flora.trees[kind]!.weight;
        kind++;
      }
      spots[kind]!.push([x, h - 0.3, z]);
      placed++;
    }
    const m = new THREE.Matrix4();
    const add = (
      geometry: THREE.BufferGeometry,
      list: [number, number, number][],
      scale: [number, number],
    ) => {
      if (list.length === 0) return;
      const mesh = new THREE.InstancedMesh(geometry, this.flora.material, list.length);
      list.forEach(([x, y, z], i) => {
        const s = scale[0] + this.rand() * scale[1];
        m.compose(
          new THREE.Vector3(x, y, z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.rand() * Math.PI * 2, 0)),
          new THREE.Vector3(s, s * (0.9 + this.rand() * 0.25), s),
        );
        mesh.setMatrixAt(i, m);
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      chunk.group.add(mesh);
    };
    this.flora.trees.forEach((t, k) => add(t.geometry, spots[k]!, [0.75, 0.55]));
    add(this.flora.bush, bushes, [0.7, 0.8]);

    this.scene.add(chunk.group);
  }

  /** Herbes et rochers autour du randonneur (régénérés quand il s'éloigne). */
  private grassTiles = -1;
  updateGrass(center: THREE.Vector3) {
    const tiles = this.readyCount();
    if (center.distanceTo(this.grassCenter) < 18 && tiles === this.grassTiles) return;
    this.grassTiles = tiles;
    this.grassCenter.copy(center);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    let n = 0;
    for (let i = 0; i < this.quality.grass * 3 && n < this.quality.grass; i++) {
      const r = 1 + Math.sqrt(this.rand()) * 42;
      const a = this.rand() * Math.PI * 2;
      const x = center.x + Math.cos(a) * r;
      const z = center.z + Math.sin(a) * r;
      if (this.clearance(x, z) < 1.1) continue;
      const h = this.heightAt(x, z);
      if (h < 0.9) continue;
      q.setFromEuler(
        new THREE.Euler((this.rand() - 0.5) * 0.5, this.rand() * 6.28, (this.rand() - 0.5) * 0.5),
      );
      s.setScalar(0.6 + this.rand() * 0.9);
      m.compose(new THREE.Vector3(x, h, z), q, s);
      this.grass.setMatrixAt(n++, m);
    }
    this.grass.count = n;
    this.grass.instanceMatrix.needsUpdate = true;
  }

  /** Ciel, eau et soleil suivent la caméra ; les ombres couvrent les abords du randonneur. */
  follow(camera: THREE.Camera, focus: THREE.Vector3) {
    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    this.water.position.x = focus.x;
    this.water.position.z = focus.z;
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 150);
    this.sun.target.position.copy(focus);
  }

  disposeAll() {
    for (const chunk of [...this.chunks.values()]) this.dispose(chunk);
  }
}
