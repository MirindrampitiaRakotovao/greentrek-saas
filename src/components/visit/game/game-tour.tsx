"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { Icon } from "@/components/ui/icon";
import type { TourStep } from "@/components/visit/virtual-tour";
import {
  type Ambiance,
  AMBIANCES,
  ambianceForHour,
  buildRoute,
  lerpAngle,
  type LatLngPoint,
  locateSteps,
  positionAt,
  stepNear,
  VISIT_SPRINT,
} from "@/lib/visit/route";
import { inRanges, partyOffsets, pirogueRanges } from "@/lib/visit/world";

import { TourAudio } from "./audio";
import {
  makeBird,
  makeLemur,
  makePirogue,
  makeSignpost,
  makeWalker,
  makeZebu,
  STYLES,
  type Walker,
} from "./models";
import { QUALITY_DESKTOP, QUALITY_MOBILE, World } from "./world3d";

/**
 * Visite virtuelle « mode jeu » (étape 8b, demande de l'étudiant) : un vrai monde 3D
 * (Three.js). Le SOL est réel (relief et image satellite du lieu), la forêt est posée là où
 * l'image satellite montre de la végétation, le groupe marche sur le VRAI tracé du circuit et
 * monte en pirogue sur les tronçons que l'agence a déclarés « en pirogue ». Les personnages,
 * les arbres et les animaux (faune de Madagascar, décorative) sont des modèles construits ;
 * les sons sont synthétisés. Commandes identiques à la visite sur carte.
 */

export type GameTourProps = {
  agenceNom: string;
  titre: string;
  steps: readonly TourStep[];
  line: readonly LatLngPoint[];
  /** Étapes du chemin (y compris villages traversés) et mode du tronçon qui en part. */
  waypoints: readonly { latitude: number; longitude: number; modeSuivant: "MARCHE" | "PIROGUE" }[];
  traces: { relevés: number; total: number };
  /** Groupe de la réservation (espace voyageur) : compagnons montrés et guide. */
  party: { personnes: number; guide: boolean } | null;
  back: { href: string; label: string };
  lightHref: string;
  fallback?: ReactNode;
};

/** Vitesse du « mode jeu » : 1 km de sentier en 6 s (×3 en courant), plus lente qu'en carte. */
const KM_PER_S = 1 / 6;
const PAUSE_ETAPE_S = 3.5;
const SOUND_KEY = "gt-son";

const fmtKm = (km: number) => `${km.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;

export default function GameTour({
  agenceNom,
  titre,
  steps,
  line,
  waypoints,
  traces,
  party,
  back,
  lightHref,
  fallback,
}: GameTourProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const route = useMemo(() => buildRoute(line), [line]);
  const stepKms = useMemo(
    () =>
      locateSteps(
        route,
        steps.map((s) => [s.latitude, s.longitude] as LatLngPoint),
      ),
    [route, steps],
  );
  const pirogue = useMemo(() => pirogueRanges(route, waypoints), [route, waypoints]);
  const compagnons = party ? Math.min(3, Math.max(0, party.personnes - 1)) : 0;

  const sim = useRef({
    km: 0,
    keys: new Set<string>(),
    hold: 0 as -1 | 0 | 1,
    orbit: 0,
    orbitInput: 0,
    pitch: 0.32,
    auto: false,
    pauseUntil: 0,
    lastStep: -1,
  });
  const audioRef = useRef<TourAudio | null>(null);
  const worldRef = useRef<World | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hud, setHud] = useState({ km: 0, enPirogue: false, elev: 0 });
  const [auto, setAuto] = useState(false);
  const [card, setCard] = useState(-1);
  const [arrived, setArrived] = useState(false);
  const [help, setHelp] = useState(true);
  // Composant affiché seulement dans le navigateur (chargé sans rendu serveur) : l'ambiance
  // suit l'heure de Madagascar (UTC+3), le son suit la préférence de la plateforme.
  const [ambiance, setAmbiance] = useState<Ambiance>(() =>
    ambianceForHour((new Date().getUTCHours() + 3) % 24),
  );
  const [sound, setSound] = useState(() => {
    try {
      return window.localStorage.getItem(SOUND_KEY) !== "off";
    } catch {
      return true;
    }
  });
  // Ambiance courante, lue par la boucle d'animation.
  const ambianceRef = useRef<Ambiance>(ambiance);
  const soundRef = useRef(sound);
  useEffect(() => {
    ambianceRef.current = ambiance;
  }, [ambiance]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || route.points.length < 2) return;
    const mobile = window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
    const quality = mobile ? QUALITY_MOBILE : QUALITY_DESKTOP;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !mobile,
        powerPreference: "high-performance",
      });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / mount.clientHeight,
      0.1,
      6000,
    );
    const start = route.points[0]!;
    const proj = { lat: start[0], lng: start[1] };

    // Dégagement du sentier : grille des points du tracé (cellules de 25 m).
    const routeLocal: [number, number][] = [];
    const grid = new Map<string, [number, number][]>();
    const cell = (x: number, z: number) => `${Math.floor(x / 25)},${Math.floor(z / 25)}`;
    const routeSamples: [number, number][] = [];
    const world = new World(
      scene,
      renderer,
      proj,
      quality,
      (x, z) => {
        let min = Infinity;
        const cx = Math.floor(x / 25);
        const cz = Math.floor(z / 25);
        for (let dx = -1; dx <= 1; dx++)
          for (let dz = -1; dz <= 1; dz++)
            for (const [px, pz] of grid.get(`${cx + dx},${cz + dz}`) ?? [])
              min = Math.min(min, Math.hypot(px - x, pz - z));
        return min;
      },
      routeSamples,
    );
    worldRef.current = world;
    // Points du tracé tous les ~4 m (pour le dégagement).
    for (let km = 0; km <= route.totalKm; km += 0.004) {
      const [lat, lng] = positionAt(route, km).point;
      const p = world.projection.toLocal(lat, lng);
      routeLocal.push(p);
      routeSamples.push(p);
      const key = cell(...p);
      grid.set(key, [...(grid.get(key) ?? []), p]);
    }
    const local = (km: number) => {
      const pos = positionAt(route, km);
      const [x, z] = world.projection.toLocal(pos.point[0], pos.point[1]);
      return { x, z, bearing: pos.bearing };
    };

    // Ambiance selon l'heure de Madagascar (UTC+3).
    const initial = ambianceRef.current;
    world.setAmbiance(initial);

    // Sentier visible : ruban de terre claire le long du tracé (marche), d'eau (pirogue).
    const pathMat = new THREE.MeshStandardMaterial({
      color: "#c2a77a",
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const riverMat = new THREE.MeshStandardMaterial({
      color: "#2b8c9a",
      roughness: 0.15,
      metalness: 0.3,
      transparent: true,
      opacity: 0.85,
    });
    const buildRibbon = () => {
      const make = (
        fromKm: number,
        toKm: number,
        width: number,
        material: THREE.Material,
        lift: number,
      ) => {
        const pts: THREE.Vector3[] = [];
        for (let km = fromKm; km <= toKm + 1e-9; km += 0.006) {
          const p = local(Math.min(km, toKm));
          pts.push(new THREE.Vector3(p.x, 0, p.z));
        }
        if (pts.length < 2) return null;
        const positions: number[] = [];
        const index: number[] = [];
        pts.forEach((p, i) => {
          const next = pts[Math.min(i + 1, pts.length - 1)]!;
          const prev = pts[Math.max(i - 1, 0)]!;
          const dir = next.clone().sub(prev).setY(0).normalize();
          const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(width / 2);
          for (const s of [-1, 1]) {
            const x = p.x + side.x * s;
            const z = p.z + side.z * s;
            positions.push(x, world.heightAt(x, z) + lift, z);
          }
          if (i > 0) {
            const a = (i - 1) * 2;
            index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
          }
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        g.setIndex(index);
        g.computeVertexNormals();
        const mesh = new THREE.Mesh(g, material);
        mesh.receiveShadow = true;
        return mesh;
      };
      const group = new THREE.Group();
      let from = 0;
      for (const [a, b] of [...pirogue, [route.totalKm, route.totalKm] as [number, number]]) {
        const walk = make(from, a, 1.6, pathMat, 0.06);
        if (walk) group.add(walk);
        if (b > a) {
          const river = make(a, b, 18, riverMat, 0.35);
          if (river) group.add(river);
        }
        from = b;
      }
      return group;
    };
    let ribbon: THREE.Group | null = null;

    // Panneaux d'étape (3 m à droite du sentier).
    const posts = steps.map((step, i) => {
      const p = local(stepKms[i] ?? 0);
      const post = makeSignpost(step.ordre, step.nom);
      const rad = (p.bearing * Math.PI) / 180;
      post.position.set(p.x + Math.cos(rad) * 3, 0, p.z + Math.sin(rad) * 3);
      scene.add(post);
      return post;
    });

    // Le groupe : voyageur, guide, compagnons.
    const hero = makeWalker(STYLES.voyageur);
    scene.add(hero.root);
    const offsets = partyOffsets(compagnons, party?.guide ?? false);
    const companionStyles = [STYLES.compagnon1, STYLES.compagnon2, STYLES.compagnon3];
    let c = 0;
    const others: { walker: Walker; offset: number }[] = offsets.map((offset) => {
      const style = offset > 0 ? STYLES.guide : companionStyles[c++ % 3]!;
      const walker = makeWalker(style);
      scene.add(walker.root);
      return { walker, offset };
    });
    const boat = makePirogue();
    boat.root.visible = false;
    scene.add(boat.root);

    // Faune décorative.
    const lemurs = Array.from({ length: mobile ? 2 : 4 }, () => {
      const l = makeLemur();
      l.scale.setScalar(1.3);
      l.visible = false;
      scene.add(l);
      return l;
    });
    const zebus = steps
      .filter((s) => s.type === "Village")
      .slice(0, 4)
      .flatMap((s, i) =>
        [0, 1].map((k) => {
          const z = makeZebu();
          const p = world.projection.toLocal(s.latitude, s.longitude);
          z.position.set(p[0] + 18 + k * 4 + i, 0, p[1] - 14 - k * 5);
          z.rotation.y = i + k * 2;
          scene.add(z);
          return z;
        }),
      );
    const birds = Array.from({ length: 6 }, () => {
      const b = makeBird();
      scene.add(b.root);
      return b;
    });

    const audio = new TourAudio();
    audioRef.current = audio;
    audio.ambiance = initial;
    audio.setMuted(!soundRef.current);
    const unlock = () => audio.start();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    const onResize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    let frame = 0;
    let last = performance.now();
    let lastHud = 0;
    let lastEnsure = 0;
    let phase = 0;
    let lastStepSound = 0;
    let lastSplash = 0;
    let camBearing = local(0).bearing;
    let lemurTick = 0;
    const tmp = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    let started = false;
    let readyTiles = 0;

    const place = (walker: Walker, km: number, moving: boolean, onBoat: boolean) => {
      const p = local(km);
      walker.root.position.set(p.x, world.heightAt(p.x, p.z), p.z);
      walker.root.rotation.y = -((p.bearing * Math.PI) / 180) + Math.PI;
      walker.setSeated(onBoat);
      walker.pose(phase + km * 7, moving ? 1 : 0);
    };

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = sim.current;
      if (now - lastEnsure > 600) {
        lastEnsure = now;
        const p = local(s.km);
        world.ensureAround(p.x, p.z);
        if (!started && world.readyCount() >= 1) {
          started = true;
          ribbon = buildRibbon();
          scene.add(ribbon);
          setReady(true);
        }
        // Le ruban du sentier suit le relief : reconstruit à chaque nouvelle tuile chargée.
        const count = world.readyCount();
        if (started && ribbon && count !== readyTiles) {
          readyTiles = count;
          scene.remove(ribbon);
          ribbon.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
          ribbon = buildRibbon();
          scene.add(ribbon);
        }
        posts.forEach(
          (post) => (post.position.y = world.heightAt(post.position.x, post.position.z)),
        );
        zebus.forEach((z) => (z.position.y = world.heightAt(z.position.x, z.position.z)));
      }

      const k = s.keys;
      let dir = s.hold;
      if (k.has("ArrowUp") || k.has("z") || k.has("w")) dir = 1;
      if (k.has("ArrowDown") || k.has("s")) dir = -1;
      const sprint = k.has("Shift");
      if (s.auto && dir === 0) dir = now < s.pauseUntil ? 0 : 1;
      if (dir !== 0 && !s.auto) s.pauseUntil = 0;
      const before = s.km;
      if (started && dir !== 0 && now >= s.pauseUntil) {
        s.km = Math.min(
          route.totalKm,
          Math.max(0, s.km + dir * KM_PER_S * (sprint ? VISIT_SPRINT : 1) * dt),
        );
      }
      const moving = s.km !== before;
      const onBoat = inRanges(pirogue, s.km);
      phase += moving ? dt * (sprint ? 13 : 8) : 0;

      const near = stepNear(stepKms, s.km, 0.05);
      if (near !== -1 && near !== s.lastStep) {
        s.lastStep = near;
        setCard(near);
        if (s.auto) s.pauseUntil = now + PAUSE_ETAPE_S * 1000;
      }
      if (s.km >= route.totalKm - 1e-6 && before < route.totalKm) {
        s.auto = false;
        setAuto(false);
        setArrived(true);
      }

      // Personnages (ou pirogue).
      const hp = local(s.km);
      const groundY = world.heightAt(hp.x, hp.z);
      if (onBoat) {
        boat.root.visible = true;
        boat.root.position.set(hp.x, Math.max(groundY, 0) + 0.6 + Math.sin(now / 600) * 0.05, hp.z);
        boat.root.rotation.y = -((hp.bearing * Math.PI) / 180) + Math.PI;
        boat.root.rotation.z = Math.sin(now / 900) * 0.03;
        boat.paddle(now / 1000);
        const seats = [hero, ...others.map((o) => o.walker)];
        seats.forEach((w, i) => {
          w.setSeated(true);
          const seat = boat.seats[i % boat.seats.length]!.clone();
          w.root.position.copy(boat.root.localToWorld(seat));
          w.root.rotation.y = boat.root.rotation.y;
        });
        if (moving && now - lastSplash > 900) {
          lastSplash = now;
          audio.splash();
        }
      } else {
        boat.root.visible = false;
        place(hero, s.km, moving, false);
        others.forEach((o) => {
          const km = Math.min(route.totalKm, Math.max(0, s.km + o.offset));
          place(o.walker, km, moving, inRanges(pirogue, km));
        });
        if (
          moving &&
          Math.sin(phase) * Math.sin(phase - dt * 8) <= 0 &&
          now - lastStepSound > 120
        ) {
          lastStepSound = now;
          audio.step(sprint);
        }
      }
      const night = ambianceRef.current === "nuit" || ambianceRef.current === "crepuscule";
      hero.lantern.intensity = night ? 7 : 0;

      // Faune : lémuriens posés près du sentier, devant le groupe ; oiseaux en cercle.
      if (now - lemurTick > 1500) {
        lemurTick = now;
        lemurs.forEach((l, i) => {
          const behind =
            !l.visible || l.position.distanceTo(new THREE.Vector3(hp.x, l.position.y, hp.z)) > 140;
          if (!behind) return;
          const ahead = local(
            Math.min(route.totalKm, s.km + 0.03 + i * 0.025 + Math.random() * 0.03),
          );
          const side = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 9);
          const rad = (ahead.bearing * Math.PI) / 180;
          const x = ahead.x + Math.cos(rad) * side;
          const z = ahead.z + Math.sin(rad) * side;
          const y = world.heightAt(x, z);
          l.visible = y > 1;
          l.position.set(x, y, z);
          l.rotation.y = Math.random() * Math.PI * 2;
        });
      }
      lemurs.forEach((l, i) => {
        const tail = l.getObjectByName("queue");
        if (tail) tail.rotation.x = Math.sin(now / 500 + i) * 0.15;
      });
      birds.forEach((b, i) => {
        const a = now / 4000 + (i / birds.length) * Math.PI * 2;
        b.root.position.set(
          hp.x + Math.cos(a) * (30 + i * 3),
          groundY + 28 + Math.sin(now / 1300 + i) * 2,
          hp.z + Math.sin(a) * (30 + i * 3),
        );
        b.root.rotation.y = -a;
        b.flap(now / 1000 + i);
      });

      // Caméra à la troisième personne : derrière le groupe, regard dans le sens de la marche.
      if (k.has("ArrowLeft") || k.has("q") || k.has("a")) s.orbit -= 70 * dt;
      if (k.has("ArrowRight") || k.has("d")) s.orbit += 70 * dt;
      s.orbit += s.orbitInput * 70 * dt;
      camBearing = lerpAngle(
        camBearing,
        (hp.bearing + s.orbit + 360) % 360,
        1 - Math.exp(-dt * 2.5),
      );
      const rad = (camBearing * Math.PI) / 180;
      const dist = onBoat ? 11 : 6.5;
      const fwd = new THREE.Vector3(Math.sin(rad), 0, -Math.cos(rad));
      const target = new THREE.Vector3(hp.x, Math.max(groundY, 0) + 1.4, hp.z);
      camPos.copy(target).addScaledVector(fwd, -dist);
      camPos.y = Math.max(
        world.heightAt(camPos.x, camPos.z) + 0.8,
        target.y + 0.6 + dist * s.pitch,
      );
      camera.position.lerp(camPos, 1 - Math.exp(-dt * 6));
      tmp.copy(target).addScaledVector(fwd, 8);
      tmp.y = target.y + 0.6;
      camera.lookAt(tmp);
      world.follow(camera, target);
      world.updateGrass(target);
      audio.tick(now);

      if (now - lastHud > 150) {
        lastHud = now;
        let water = onBoat ? 1 : 0;
        if (!onBoat) {
          let wet = 0;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            if (world.heightAt(hp.x + Math.cos(a) * 70, hp.z + Math.sin(a) * 70) < 0.5) wet++;
          }
          water = wet / 8;
        }
        audio.setWater(water);
        setHud({ km: s.km, enPirogue: onBoat, elev: groundY });
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      audio.dispose();
      world.disposeAll();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- monde créé une seule fois
  }, [route]);

  // Clavier.
  useEffect(() => {
    const keys = sim.current.keys;
    const normalize = (e: KeyboardEvent) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
    const MOVE = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "z",
      "q",
      "s",
      "d",
      "w",
      "a",
      "Shift",
    ];
    const down = (e: KeyboardEvent) => {
      const key = normalize(e);
      if (key === " ") {
        e.preventDefault();
        toggleAuto();
        return;
      }
      if (MOVE.includes(key)) {
        if (key.startsWith("Arrow")) e.preventDefault();
        keys.add(key);
        setHelp(false);
      }
    };
    const up = (e: KeyboardEvent) => keys.delete(normalize(e));
    const blur = () => keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleAuto() {
    const s = sim.current;
    if (s.km >= route.totalKm - 1e-6) {
      s.km = 0;
      s.lastStep = -1;
      setArrived(false);
    }
    s.auto = !s.auto;
    s.pauseUntil = 0;
    setAuto(s.auto);
    setHelp(false);
    audioRef.current?.start();
  }

  function chooseAmbiance(value: Ambiance) {
    setAmbiance(value);
    worldRef.current?.setAmbiance(value);
    if (audioRef.current) audioRef.current.ambiance = value;
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    audioRef.current?.start();
    audioRef.current?.setMuted(!next);
    try {
      window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {
      // stockage indisponible
    }
  }

  function jumpToStep(index: number) {
    const km = stepKms[index];
    if (km === undefined) return;
    sim.current.km = km;
    sim.current.lastStep = index;
    sim.current.pauseUntil = performance.now() + PAUSE_ETAPE_S * 1000;
    setCard(index);
  }

  const drag = useRef<{ x: number; y: number } | null>(null);
  const hold = (value: -1 | 0 | 1) => () => {
    sim.current.hold = value;
    if (value !== 0) setHelp(false);
  };
  const orbit = (value: -1 | 0 | 1) => () => {
    sim.current.orbitInput = value;
  };

  if (failed) return <>{fallback ?? null}</>;

  const progress = route.totalKm > 0 ? hud.km / route.totalKm : 0;
  const current = card >= 0 ? steps[card] : undefined;
  const nextIndex = stepKms.findIndex((km) => km > hud.km + 0.05);
  const next = nextIndex >= 0 ? steps[nextIndex] : undefined;
  const groupe = party
    ? `Vous${party.personnes > 1 ? ` et ${party.personnes - 1} compagnon${party.personnes > 2 ? "s" : ""}` : ""}${party.guide ? ", avec votre guide" : ""}`
    : null;

  return (
    <div
      className="gt-tour relative h-dvh w-full overflow-hidden bg-[#061b20] text-white select-none"
      data-ambiance={ambiance}
    >
      <div
        ref={mountRef}
        className="absolute inset-0 touch-none"
        role="img"
        aria-label={`Visite virtuelle en 3D du circuit ${titre} : ${steps.map((s) => s.nom).join(", ")}`}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          sim.current.orbit += (e.clientX - drag.current.x) * 0.3;
          sim.current.pitch = Math.min(
            0.9,
            Math.max(0.05, sim.current.pitch + (e.clientY - drag.current.y) * 0.003),
          );
          drag.current = { x: e.clientX, y: e.clientY };
          setHelp(false);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      />
      <div aria-hidden="true" className="gt-tour-vignette pointer-events-none absolute inset-0" />

      {!ready ? (
        <div className="absolute inset-0 grid place-items-center bg-[#061b20]">
          <div className="text-center">
            <p className="font-display text-3xl">{titre}</p>
            <p className="mt-2 text-sm text-white/70">
              Construction du monde : relief, forêts, faune…
            </p>
          </div>
        </div>
      ) : null}

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-5">
        <div className="gt3d-glass pointer-events-auto flex max-w-[70%] items-center gap-3 p-2 pr-4 sm:max-w-md">
          <Link
            href={back.href}
            className="gt3d-btn shrink-0"
            aria-label={back.label}
            title={back.label}
          >
            <Icon name="navigation" className="size-4 -rotate-[135deg]" />
          </Link>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] text-white/70">
              <span className="rounded-full bg-gt-sand-300 px-2 py-px font-semibold whitespace-nowrap text-gt-teal-900">
                Mode jeu
              </span>
              <span className="truncate">{agenceNom}</span>
            </p>
            <h1 className="truncate font-display text-lg leading-tight sm:text-xl">{titre}</h1>
            {groupe ? <p className="truncate text-[11px] text-white/70">{groupe}</p> : null}
          </div>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={sound}
              className="gt3d-glass grid size-10 place-items-center"
              aria-label={sound ? "Couper le son" : "Activer le son"}
              title={sound ? "Couper le son" : "Activer le son"}
            >
              <Icon name="volume" className={`size-4 ${sound ? "" : "opacity-40"}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                const order = Object.keys(AMBIANCES) as Ambiance[];
                chooseAmbiance(order[(order.indexOf(ambiance) + 1) % order.length]!);
              }}
              className="gt3d-glass flex h-10 items-center gap-2 px-3 text-xs font-semibold whitespace-nowrap"
              aria-label={`Ambiance : ${AMBIANCES[ambiance].label} (changer)`}
            >
              <Icon
                name={ambiance === "nuit" || ambiance === "crepuscule" ? "moon" : "sun"}
                className="size-4 text-gt-sand-300"
              />
              <span className="hidden sm:inline">{AMBIANCES[ambiance].label}</span>
            </button>
          </div>
          <Link
            href={lightHref}
            className="gt3d-glass px-3 py-1.5 text-[11px] text-white/80 hover:text-white"
          >
            <span className="sm:hidden">Carte</span>
            <span className="hidden sm:inline">Mode léger (carte)</span>
          </Link>
        </div>
      </header>

      {current ? (
        <aside
          aria-live="polite"
          className="gt3d-glass gt-tour-card absolute top-24 left-3 w-[min(22rem,calc(100%-1.5rem))] p-3 sm:top-28 sm:left-5 sm:p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-gt-sand-300 font-bold text-gt-teal-900">
                {current.ordre}
              </span>
              <span className="text-xs text-white/70">
                Étape {card + 1} / {steps.length}
                {current.jour ? ` · jour ${current.jour}` : ""} · {current.type}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setCard(-1)}
              className="gt3d-btn size-7"
              aria-label="Fermer la fiche"
            >
              <Icon name="close" className="size-3.5" />
            </button>
          </div>
          <h2 className="mt-2 font-display text-xl leading-tight sm:text-2xl">{current.nom}</h2>
          {current.description ? (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/85 sm:mt-2 sm:line-clamp-5">
              {current.description}
            </p>
          ) : null}
        </aside>
      ) : null}

      {hud.enPirogue ? (
        <p className="gt3d-glass absolute top-24 right-3 px-3 py-2 text-sm font-semibold sm:top-28 sm:right-5">
          En pirogue
        </p>
      ) : null}

      {arrived ? (
        <div className="absolute inset-0 grid place-items-center bg-black/30">
          <div className="gt3d-glass max-w-sm p-6 text-center">
            <p className="text-sm text-gt-sand-300">Arrivée</p>
            <p className="mt-1 font-display text-3xl">{steps.at(-1)?.nom}</p>
            <p className="mt-2 text-sm text-white/80">
              {fmtKm(route.totalKm)} parcourus en {steps.length} étapes.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={toggleAuto}
                className="rounded-full bg-gt-sand-300 px-4 py-2 text-sm font-semibold text-gt-teal-900"
              >
                Recommencer
              </button>
              <Link
                href={back.href}
                className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium"
              >
                {back.label}
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {help && ready ? (
        <div className="gt3d-glass pointer-events-none absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 p-5 text-center text-sm sm:block">
          <p className="font-display text-xl">Prêt pour la balade ?</p>
          <p className="mt-2 text-white/80">
            <kbd className="gt-kbd">↑</kbd> ou <kbd className="gt-kbd">Z</kbd> avancer ·{" "}
            <kbd className="gt-kbd">Maj</kbd> courir · <kbd className="gt-kbd">← →</kbd> tourner
          </p>
          <p className="mt-1 text-white/80">
            Glisser pour regarder autour · <kbd className="gt-kbd">Espace</kbd> visite automatique ·
            son au premier clic
          </p>
        </div>
      ) : null}

      <footer className="absolute inset-x-0 bottom-0 p-3 sm:p-5">
        <div className="gt3d-glass mx-auto max-w-4xl p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-white/80">
            <span>
              <strong className="text-sm text-white">{fmtKm(hud.km)}</strong> /{" "}
              {fmtKm(route.totalKm)}
            </span>
            <span>{next ? `Prochaine étape : ${next.nom}` : "Dernière étape atteinte"}</span>
            <span title="Altitude du modèle de terrain (Mapzen), à quelques mètres près">
              Altitude ≈ {Math.round(hud.elev)} m
            </span>
          </div>
          <div className="relative mt-3 h-2 rounded-full bg-white/15">
            {pirogue.map(([a, b]) => (
              <div
                key={`${a}-${b}`}
                className="absolute inset-y-0 rounded-full bg-[#3fb6d8]/70"
                style={{
                  left: `${(a / route.totalKm) * 100}%`,
                  width: `${((b - a) / route.totalKm) * 100}%`,
                }}
                title="En pirogue"
              />
            ))}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gt-sand-300"
              style={{ width: `${progress * 100}%` }}
            />
            {stepKms.map((km, i) => (
              <button
                key={`${steps[i]!.ordre}-${i}`}
                type="button"
                onClick={() => jumpToStep(i)}
                className={`absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#061b20] ${
                  km <= hud.km + 0.01 ? "bg-gt-sand-300" : "bg-white/60"
                }`}
                style={{ left: `${route.totalKm > 0 ? (km / route.totalKm) * 100 : 0}%` }}
                aria-label={`Aller à l'étape ${i + 1} : ${steps[i]!.nom}`}
                title={steps[i]!.nom}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="gt3d-btn"
                aria-label="Tourner la caméra à gauche"
                onPointerDown={orbit(-1)}
                onPointerUp={orbit(0)}
                onPointerLeave={orbit(0)}
              >
                <Icon name="swap" className="size-4 -scale-x-100" />
              </button>
              <button
                type="button"
                className="gt3d-btn"
                aria-label="Reculer (maintenir)"
                onPointerDown={hold(-1)}
                onPointerUp={hold(0)}
                onPointerLeave={hold(0)}
              >
                <Icon name="minus" className="size-4" />
              </button>
              <button
                type="button"
                className="gt3d-btn gt3d-btn--accent size-11"
                aria-label="Avancer (maintenir)"
                onPointerDown={hold(1)}
                onPointerUp={hold(0)}
                onPointerLeave={hold(0)}
              >
                <Icon name="navigation" className="size-5 rotate-45" />
              </button>
              <button
                type="button"
                className="gt3d-btn"
                aria-label="Tourner la caméra à droite"
                onPointerDown={orbit(1)}
                onPointerUp={orbit(0)}
                onPointerLeave={orbit(0)}
              >
                <Icon name="swap" className="size-4" />
              </button>
            </div>
            <p className="hidden text-center text-[11px] leading-snug text-white/60 md:block">
              Sol, relief et sentier réels
              {traces.relevés > 0
                ? ` (${traces.relevés}/${traces.total} tronçons tracés)`
                : " (tracé indicatif)"}{" "}
              · arbres placés sur la végétation de l&apos;image satellite · animaux illustratifs de
              la faune malgache
            </p>
            <button
              type="button"
              onClick={toggleAuto}
              aria-pressed={auto}
              className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap ${
                auto
                  ? "bg-gt-sand-300 text-gt-teal-900"
                  : "bg-white/12 text-white hover:bg-white/20"
              }`}
            >
              <Icon name={auto ? "minus" : "play"} className="size-4" />
              {auto ? (
                "Pause"
              ) : (
                <>
                  <span className="sm:hidden">Auto</span>
                  <span className="hidden sm:inline">Visite automatique</span>
                </>
              )}
            </button>
          </div>
        </div>
        <p className="mt-1 truncate text-center text-[10px] text-white/55">
          Imagerie © Esri, Maxar, Earthstar Geographics · relief Mapzen (AWS) · modèles 3D et sons
          créés pour Green Trek
        </p>
      </footer>
    </div>
  );
}
