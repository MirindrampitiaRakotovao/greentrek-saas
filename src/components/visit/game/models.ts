import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Modèles 3D de la visite « mode jeu » (étape 8b), construits avec des formes simples (style
 * « jeu indépendant », facettes nettes) : aucun fichier 3D externe, donc aucun droit à céder.
 * Les personnages sont articulés (hanches, genoux, épaules) pour l'animation de marche.
 */

const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.82, flatShading: true, ...extra });

function withShadows<T extends THREE.Object3D>(object: T): T {
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return object;
}

/* ─── Personnages ────────────────────────────────────────────────────────────────── */

export type Walker = {
  root: THREE.Group;
  /** Phase de marche (radians) ; `amplitude` 0 = immobile, 1 = marche. */
  pose: (phase: number, amplitude: number) => void;
  /** Assis (dans la pirogue) ou debout. */
  setSeated: (seated: boolean) => void;
  lantern: THREE.PointLight;
};

export type WalkerStyle = {
  shirt: string;
  pants: string;
  pack: string | null;
  hat: "chapeau" | "casquette" | "satroka";
  skin: string;
};

export const STYLES: Record<
  "voyageur" | "compagnon1" | "compagnon2" | "compagnon3" | "guide",
  WalkerStyle
> = {
  voyageur: {
    shirt: "#24586a",
    pants: "#3a3a2e",
    pack: "#b8572e",
    hat: "chapeau",
    skin: "#8a5a3c",
  },
  compagnon1: {
    shirt: "#7a3b5e",
    pants: "#2f3b4a",
    pack: "#3f6f4a",
    hat: "casquette",
    skin: "#c58c66",
  },
  compagnon2: {
    shirt: "#c98a1b",
    pants: "#3b3328",
    pack: "#2a4a6b",
    hat: "chapeau",
    skin: "#6b4430",
  },
  compagnon3: {
    shirt: "#3f7f6f",
    pants: "#4a3a2a",
    pack: "#8a3030",
    hat: "casquette",
    skin: "#e0b08a",
  },
  // Guide : chemise sable et chapeau tressé (satroka), sans gros sac.
  guide: { shirt: "#e9c27a", pants: "#2e3d2e", pack: null, hat: "satroka", skin: "#5e3b28" },
};

/** Membre articulé : pivot en haut, segment supérieur puis inférieur (avec articulation). */
function limb(
  upper: number,
  lower: number,
  radius: number,
  color: THREE.Material,
  foot?: THREE.Material,
) {
  const pivot = new THREE.Group();
  const up = new THREE.Mesh(new THREE.CapsuleGeometry(radius, upper, 3, 8), color);
  up.position.y = -upper / 2;
  pivot.add(up);
  const joint = new THREE.Group();
  joint.position.y = -upper - radius * 0.4;
  pivot.add(joint);
  const low = new THREE.Mesh(new THREE.CapsuleGeometry(radius * 0.9, lower, 3, 8), color);
  low.position.y = -lower / 2;
  joint.add(low);
  if (foot) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(radius * 1.8, radius * 1.1, radius * 3.2), foot);
    f.position.set(0, -lower - radius * 0.6, radius * 0.8);
    joint.add(f);
  }
  return { pivot, joint };
}

export function makeWalker(style: WalkerStyle): Walker {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const shirt = mat(style.shirt);
  const pants = mat(style.pants);
  const skin = mat(style.skin);
  const boot = mat("#2a201a");

  const hips = new THREE.Group();
  hips.position.y = 0.92;
  body.add(hips);
  const legL = limb(0.38, 0.4, 0.085, pants, boot);
  const legR = limb(0.38, 0.4, 0.085, pants, boot);
  legL.pivot.position.x = -0.12;
  legR.pivot.position.x = 0.12;
  hips.add(legL.pivot, legR.pivot);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.38, 4, 10), shirt);
  torso.position.y = 0.32;
  hips.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), skin);
  head.position.y = 0.78;
  hips.add(head);

  const armL = limb(0.28, 0.28, 0.065, shirt);
  const armR = limb(0.28, 0.28, 0.065, shirt);
  armL.pivot.position.set(-0.28, 0.6, 0);
  armR.pivot.position.set(0.28, 0.6, 0);
  hips.add(armL.pivot, armR.pivot);
  for (const arm of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), skin);
    hand.position.y = -0.34;
    arm.joint.add(hand);
  }

  if (style.hat === "chapeau") {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 20), mat("#e9c27a"));
    brim.position.y = 0.87;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.13, 16), mat("#e9c27a"));
    crown.position.y = 0.94;
    hips.add(brim, crown);
  } else if (style.hat === "casquette") {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      mat("#f2f3f5"),
    );
    cap.position.y = 0.82;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.14), mat("#f2f3f5"));
    visor.position.set(0, 0.83, 0.17);
    hips.add(cap, visor);
  } else {
    const satroka = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.2, 16), mat("#d9b56a"));
    satroka.position.y = 0.96;
    hips.add(satroka);
  }

  if (style.pack) {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.26, 2, 2, 2), mat(style.pack));
    pack.position.set(0, 0.36, -0.26);
    const roll = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.44, 10).rotateZ(Math.PI / 2),
      mat("#6f7a3a"),
    );
    roll.position.set(0, 0.68, -0.26);
    hips.add(pack, roll);
  }
  // Bâton de marche dans la main droite.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 1.2, 6),
    mat("#dfe6e6", { metalness: 0.6 }),
  );
  pole.position.set(0, -0.3, 0.12);
  armR.joint.add(pole);

  const lantern = new THREE.PointLight("#ffcf86", 0, 16, 1.5);
  lantern.position.set(0.3, 1.2, 0.2);
  root.add(lantern);

  let seated = false;
  const pose = (phase: number, amplitude: number) => {
    if (seated) return;
    const s = Math.sin(phase) * amplitude;
    legL.pivot.rotation.x = s * 0.55;
    legR.pivot.rotation.x = -s * 0.55;
    legL.joint.rotation.x = Math.max(0, -Math.sin(phase + 0.6)) * 0.7 * amplitude;
    legR.joint.rotation.x = Math.max(0, Math.sin(phase + 0.6)) * 0.7 * amplitude;
    armL.pivot.rotation.x = -s * 0.45;
    armR.pivot.rotation.x = s * 0.35 - 0.2 * amplitude;
    armL.joint.rotation.x = -0.2 * amplitude;
    armR.joint.rotation.x = -0.35;
    hips.position.y = 0.92 + Math.abs(Math.cos(phase)) * 0.04 * amplitude;
    body.rotation.z = Math.sin(phase) * 0.03 * amplitude;
  };
  const setSeated = (value: boolean) => {
    seated = value;
    legL.pivot.rotation.x = legR.pivot.rotation.x = value ? -1.45 : 0;
    legL.joint.rotation.x = legR.joint.rotation.x = value ? 1.5 : 0;
    armL.pivot.rotation.x = armR.pivot.rotation.x = value ? -0.5 : 0;
    hips.position.y = value ? 0.32 : 0.92;
    pole.visible = !value;
  };
  return { root: withShadows(root), pose, setSeated, lantern };
}

/* ─── Végétation (géométries fusionnées, couleurs par sommet) ─────────────────────── */

/** Fusionne les pièces d'un modèle en une géométrie à couleurs par sommet (instanciable). */
function bake(group: THREE.Group, jitter = 0.18): THREE.BufferGeometry {
  group.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  let seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry.clone().toNonIndexed();
    geometry.applyMatrix4(mesh.matrixWorld);
    const color = new THREE.Color((mesh.material as THREE.MeshStandardMaterial).color);
    const count = geometry.attributes.position!.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 3) {
      const shade = 1 - jitter / 2 + rnd() * jitter;
      for (let k = 0; k < 3; k++) {
        colors[(i + k) * 3] = color.r * shade;
        colors[(i + k) * 3 + 1] = color.g * shade;
        colors[(i + k) * 3 + 2] = color.b * shade;
      }
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    for (const name of Object.keys(geometry.attributes)) {
      if (!["position", "normal", "color"].includes(name)) geometry.deleteAttribute(name);
    }
    parts.push(geometry);
  });
  const merged = mergeGeometries(parts)!;
  merged.computeVertexNormals();
  return merged;
}

function palm(h: number, lean: number): THREE.Group {
  const g = new THREE.Group();
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    const s = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15 - i * 0.008, 0.2 - i * 0.008, h / segs + 0.05, 7),
      mat("#7b6346"),
    );
    s.position.set(i * i * lean, (i + 0.5) * (h / segs), 0);
    g.add(s);
  }
  const top = new THREE.Vector3(segs * segs * lean, h, 0);
  for (let k = 0; k < 10; k++) {
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 3.6, 4, 1).translate(0, 1.8, 0),
      mat(k % 2 ? "#3f7d2f" : "#57993b"),
    );
    leaf.scale.set(1, 1, 0.18);
    leaf.position.copy(top);
    leaf.rotation.set(1.05 + (k % 3) * 0.18, (k / 10) * Math.PI * 2, 0, "YXZ");
    g.add(leaf);
  }
  const coco = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), mat("#6b5a2a"));
  coco.position.copy(top).add(new THREE.Vector3(0, -0.3, 0));
  g.add(coco);
  return g;
}

/** Ravenala (arbre du voyageur) : éventail de grandes feuilles, emblème de Madagascar. */
function ravenala(h: number): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, h, 8), mat("#8b7d62"));
  trunk.position.y = h / 2;
  g.add(trunk);
  for (let k = 0; k < 15; k++) {
    const a = -1.25 + (k / 14) * 2.5;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.06, 2.4, 5).translate(0, 1.2, 0),
      mat("#6f8a4a"),
    );
    stem.position.y = h;
    stem.rotation.z = a;
    const leaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 3.2, 0.04).translate(0, 3.9, 0),
      mat(k % 2 ? "#4d8a3a" : "#64a346"),
    );
    leaf.position.y = h;
    leaf.rotation.z = a;
    g.add(stem, leaf);
  }
  return g;
}

function broadleaf(h: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, h * 0.62, 7), mat("#5a4632"));
  trunk.position.y = h * 0.31;
  g.add(trunk);
  for (const [a, l] of [
    [0.6, 1],
    [2.6, 0.8],
    [4.4, 0.9],
  ] as const) {
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.12, h * 0.3 * l, 5).translate(0, h * 0.15 * l, 0),
      mat("#5a4632"),
    );
    branch.position.y = h * 0.5;
    branch.rotation.set(0.7, a, 0, "YXZ");
    g.add(branch);
  }
  const greens = ["#2e6a28", "#3b7d30", "#24581f", "#4a8a33", "#356f2a"];
  for (let k = 0; k < 12; k++) {
    const r = h * (0.15 + ((seed * (k + 3)) % 7) * 0.02);
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat(greens[(k + seed) % 5]!));
    const a = k * 2.4 + seed;
    const ring = k < 6 ? 0.26 : 0.12;
    blob.position.set(
      Math.cos(a) * h * ring,
      h * (0.62 + ((k * 7 + seed) % 5) * 0.075),
      Math.sin(a) * h * ring,
    );
    g.add(blob);
  }
  return g;
}

function bush(): THREE.Group {
  const g = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const b = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.55 + (k % 2) * 0.25, 0),
      mat(k % 2 ? "#3a6f2c" : "#4d8a36"),
    );
    b.position.set(Math.cos(k * 1.7) * 0.5, 0.45, Math.sin(k * 1.7) * 0.5);
    g.add(b);
  }
  return g;
}

function rock(): THREE.Group {
  const g = new THREE.Group();
  const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), mat("#7d7a72"));
  r.scale.set(1.4, 0.7, 1.1);
  r.position.y = 0.25;
  g.add(r);
  return g;
}

/** Les espèces d'arbres, avec leur poids de tirage (feuillus dominants, palmiers, ravenales). */
export function makeFlora() {
  return {
    trees: [
      { geometry: bake(palm(8, 0.025)), weight: 0.12 },
      { geometry: bake(palm(11, 0.04)), weight: 0.1 },
      { geometry: bake(ravenala(5)), weight: 0.12 },
      { geometry: bake(ravenala(7)), weight: 0.07 },
      { geometry: bake(broadleaf(9, 1)), weight: 0.2 },
      { geometry: bake(broadleaf(12, 2)), weight: 0.22 },
      { geometry: bake(broadleaf(15, 3)), weight: 0.17 },
    ],
    bush: bake(bush()),
    rock: bake(rock(), 0.1),
    material: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      flatShading: true,
    }),
  };
}

/* ─── Faune (décorative : animaux de Madagascar, sans prétention de présence réelle) ── */

export function makeLemur(): THREE.Group {
  const g = new THREE.Group();
  const fur = mat("#9c9a96");
  const white = mat("#efece6");
  const black = mat("#1d1b1a");
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.28, 4, 8), fur);
  body.rotation.x = 1.1;
  body.position.set(0, 0.32, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), white);
  head.position.set(0, 0.52, 0.16);
  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), black);
  mask.position.set(0, 0.52, 0.255);
  for (const x of [-0.04, 0.04]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), mat("#e3a21a"));
    eye.position.set(x, 0.55, 0.245);
    g.add(eye);
  }
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 5), fur);
  earL.position.set(-0.06, 0.62, 0.13);
  const earR = earL.clone();
  earR.position.x = 0.06;
  g.add(body, head, mask, earL, earR);
  // Queue annelée noir et blanc, dressée.
  const tail = new THREE.Group();
  tail.name = "queue";
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    const ring = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), i % 2 ? black : white);
    ring.position.set(0, t * 0.85 + Math.sin(t * 3) * 0.05, -Math.sin(t * Math.PI * 0.9) * 0.3);
    tail.add(ring);
  }
  tail.position.set(0, 0.25, -0.2);
  g.add(tail);
  for (const [x, z] of [
    [-0.08, 0.1],
    [0.08, 0.1],
    [-0.08, -0.12],
    [0.08, -0.12],
  ] as const) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.18, 3, 6), fur);
    leg.position.set(x, 0.12, z);
    g.add(leg);
  }
  return withShadows(g);
}

export function makeZebu(): THREE.Group {
  const g = new THREE.Group();
  const coat = mat(Math.random() < 0.5 ? "#a8764a" : "#e3d6bf");
  const dark = mat("#4a3424");
  const horn = mat("#e8dcc0");
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 1.0, 4, 10).rotateZ(Math.PI / 2),
    coat,
  );
  body.position.y = 1.0;
  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), coat);
  hump.position.set(0.45, 1.42, 0);
  hump.scale.set(1, 1.1, 0.8);
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.3, 4, 8), coat);
  neck.position.set(0.85, 1.15, 0);
  neck.rotation.z = -0.9;
  const head = new THREE.Group();
  head.name = "tete";
  head.position.set(1.05, 1.05, 0);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.3), coat);
  skull.rotation.z = -0.5;
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.26), dark);
  muzzle.position.set(0.2, -0.15, 0);
  const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.42, 6), horn);
  hornL.position.set(0, 0.3, 0.14);
  hornL.rotation.x = -0.6;
  const hornR = hornL.clone();
  hornR.position.z = -0.14;
  hornR.rotation.x = 0.6;
  head.add(skull, muzzle, hornL, hornR);
  const dewlap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.08), coat);
  dewlap.position.set(0.85, 0.72, 0);
  g.add(body, hump, neck, head, dewlap);
  for (const [x, z] of [
    [-0.5, 0.22],
    [-0.5, -0.22],
    [0.5, 0.22],
    [0.5, -0.22],
  ] as const) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.75, 6), coat);
    leg.position.set(x, 0.38, z);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 6), dark);
    hoof.position.set(x, 0.04, z);
    g.add(leg, hoof);
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 4), dark);
  tail.position.set(-1.05, 0.85, 0);
  tail.rotation.z = 0.25;
  g.add(tail);
  return withShadows(g);
}

/** Oiseau (vol plané, ailes battantes) : deux ailes articulées. */
export function makeBird(): { root: THREE.Group; flap: (t: number) => void } {
  const root = new THREE.Group();
  const dark = mat("#1c2a2e");
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.08, 0.3, 3, 6).rotateX(Math.PI / 2),
    dark,
  );
  const wingL = new THREE.Group();
  const wingR = new THREE.Group();
  const shape = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.25).translate(0.35, 0, 0), dark);
  wingL.add(shape.clone());
  wingR.add(shape.clone());
  wingL.rotation.y = Math.PI;
  root.add(body, wingL, wingR);
  return {
    root,
    flap: (t) => {
      const a = Math.sin(t * 9) * 0.6;
      wingR.rotation.z = a;
      wingL.rotation.z = -a;
    },
  };
}

/* ─── Pirogue et piroguier ──────────────────────────────────────────────────────── */

export function makePirogue(): {
  root: THREE.Group;
  paddle: (t: number) => void;
  seats: THREE.Vector3[];
} {
  const root = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-3.4, 0);
  shape.quadraticCurveTo(0, -0.8, 3.4, 0);
  shape.lineTo(3.4, 0.1);
  shape.quadraticCurveTo(0, -0.45, -3.4, 0.1);
  const hull = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false })
      .translate(0, 0.3, -0.35)
      .rotateY(Math.PI / 2),
    mat("#6b4a2b"),
  );
  const floor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 5.8), mat("#3d2a18"));
  floor.position.y = 0.06;
  root.add(hull, floor);
  // Piroguier debout à l'arrière, perche/pagaie animée.
  const man = makeWalker({
    shirt: "#c9a227",
    pants: "#3a2e22",
    pack: null,
    hat: "satroka",
    skin: "#6b4430",
  });
  man.root.position.set(0, 0.05, -2.6);
  root.add(man.root);
  const oar = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 6), mat("#a07a4a"));
  shaft.position.y = -0.4;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.03), mat("#a07a4a"));
  blade.position.y = -1.45;
  oar.add(shaft, blade);
  oar.position.set(0.35, 1.3, -2.4);
  root.add(oar);
  withShadows(root);
  return {
    root,
    seats: [
      new THREE.Vector3(0, 0.05, 1.6),
      new THREE.Vector3(0, 0.05, 0.5),
      new THREE.Vector3(0, 0.05, -0.6),
      new THREE.Vector3(0, 0.05, -1.6),
    ],
    paddle: (t) => {
      oar.rotation.x = Math.sin(t * 2.2) * 0.6 + 0.2;
      oar.rotation.z = -0.35;
      man.pose(t * 2.2, 0.15);
    },
  };
}

/* ─── Panneau d'étape (poteau en bois, nom lisible de loin) ─────────────────────── */

export function makeSignpost(ordre: number, nom: string): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.6, 6), mat("#6b4f33"));
  post.position.y = 1.3;
  g.add(post);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(15,65,77,0.92)";
  ctx.beginPath();
  ctx.roundRect(4, 4, 504, 120, 60);
  ctx.fill();
  ctx.fillStyle = "#fad594";
  ctx.beginPath();
  ctx.arc(64, 64, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0f414d";
  ctx.font = "bold 52px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(ordre), 64, 66);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.font = "600 46px sans-serif";
  ctx.fillText(nom.length > 16 ? `${nom.slice(0, 15)}…` : nom, 124, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
  label.scale.set(3, 0.75, 1);
  label.position.y = 3.1;
  g.add(label);
  return withShadows(g);
}
