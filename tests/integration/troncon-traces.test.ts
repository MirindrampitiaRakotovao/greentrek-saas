import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { estimateDurationMinutes } from "@/lib/graph/estimation";
import { roundedLengthKm, type TracePoint } from "@/lib/graph/trace";
import { computeItineraire } from "@/lib/services/itineraires";
import {
  clearTrace,
  proposeAndSaveTrace,
  proposeTrace,
  saveTrace,
} from "@/lib/services/troncon-traces";
import { getTenantDb, type TenantDb } from "@/lib/tenant";
import { saveTraceSchema } from "@/lib/validators/circuits";

import { createTestClient, truncateAll } from "./test-db";

/**
 * Tracés réels des tronçons (étape 6b-2). Le service de trajets d'OpenStreetMap est remplacé
 * par un faux (aucun appel réseau pendant les tests). Coordonnées : valeurs de test.
 */
const raw = createTestClient();

afterAll(async () => {
  await raw.$disconnect();
});

const P_A: TracePoint = [49.45, -17.49];
const P_B: TracePoint = [49.47, -17.47];
const BEND: TracePoint = [49.465, -17.488];

let agenceA: { id: string };
let dbA: TenantDb;
let dbB: TenantDb;
let a: string;
let b: string;
let tronconId: string;

/** Faux service OSRM : renvoie un chemin A → virage → B (ou une réponse donnée). */
function fakeOsrm(
  body: unknown = {
    code: "Ok",
    routes: [{ distance: 3100, geometry: { coordinates: [P_A, BEND, P_B] } }],
    waypoints: [{ distance: 5 }, { distance: 8 }],
  },
) {
  const calls: string[] = [];
  const fetcher = (async (url: string | URL | Request) => {
    calls.push(String(url));
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  return { fetcher, calls };
}

beforeEach(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({ data: { nom: "Agence A", slug: "agence-a" } });
  const agenceB = await raw.agence.create({ data: { nom: "Agence B", slug: "agence-b" } });
  dbA = getTenantDb(agenceA.id, raw);
  dbB = getTenantDb(agenceB.id, raw);
  const etape = async (nom: string, [lng, lat]: TracePoint) =>
    (
      await raw.etape.create({
        data: { agenceId: agenceA.id, nom, type: "VILLAGE", latitude: lat, longitude: lng },
      })
    ).id;
  a = await etape("Village A", P_A);
  b = await etape("Village B", P_B);
  tronconId = (
    await raw.troncon.create({
      data: {
        agenceId: agenceA.id,
        etapeDepartId: a,
        etapeArriveeId: b,
        distanceKm: 3.7,
        dureeMinutes: 56,
        deniveleM: 120,
        difficulte: 2,
        bidirectionnel: true,
        distanceEstimee: true,
      },
    })
  ).id;
});

describe("proposition d'OpenStreetMap", () => {
  it("demande le chemin à pied avec les seules coordonnées des étapes, sans rien enregistrer", async () => {
    const { fetcher, calls } = fakeOsrm();
    const result = await proposeTrace(dbA, tronconId, fetcher);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.trace).toEqual([P_A, BEND, P_B]);
    expect(result.data.longueurKm).toBe(roundedLengthKm([P_A, BEND, P_B]));
    expect(result.data.accrocheM).toEqual([5, 8]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(
      `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${P_A.join(",")};${P_B.join(",")}?overview=full&geometries=geojson`,
    );
    const t = await raw.troncon.findUniqueOrThrow({ where: { id: tronconId } });
    expect(t.trace).toBeNull();
  });

  it("message clair si OSM ne connaît aucun chemin, ou ne répond pas", async () => {
    const none = await proposeTrace(dbA, tronconId, fakeOsrm({ code: "NoRoute" }).fetcher);
    expect(none).toEqual({
      ok: false,
      error: "OpenStreetMap ne connaît aucun chemin à pied entre ces deux étapes.",
    });
    const down = await proposeTrace(dbA, tronconId, (async () => {
      throw new Error("réseau");
    }) as typeof fetch);
    expect(down.ok).toBe(false);
  });
});

describe("enregistrement (choix (a) de l'étudiant)", () => {
  const trace = [P_A, BEND, P_B];

  it("remplace la distance par la longueur du tracé, durée recalculée, reste « estimé »", async () => {
    const result = await saveTrace(dbA, {
      tronconId,
      trace,
      source: "OSM",
      remplacerDistance: true,
    });
    const longueur = roundedLengthKm(trace);
    expect(result).toEqual({
      ok: true,
      data: { distanceKm: longueur, dureeMinutes: estimateDurationMinutes(longueur, 120) },
    });
    const t = await raw.troncon.findUniqueOrThrow({ where: { id: tronconId } });
    expect(t.trace).toEqual(trace);
    expect(t.traceSource).toBe("OSM");
    expect(t.distanceKm).toBe(longueur);
    expect(t.distanceEstimee).toBe(true);
  });

  it("garde la distance et la durée si la case est décochée", async () => {
    await saveTrace(dbA, { tronconId, trace, source: "MANUEL", remplacerDistance: false });
    const t = await raw.troncon.findUniqueOrThrow({ where: { id: tronconId } });
    expect([t.distanceKm, t.dureeMinutes, t.traceSource]).toEqual([3.7, 56, "MANUEL"]);
  });

  it("extrémités recollées sur les étapes ; refus si le tracé ne part pas du départ", async () => {
    const near: TracePoint = [P_A[0] + 0.001, P_A[1]];
    await saveTrace(dbA, {
      tronconId,
      trace: [near, BEND, P_B],
      source: "MANUEL",
      remplacerDistance: false,
    });
    const t = await raw.troncon.findUniqueOrThrow({ where: { id: tronconId } });
    expect((t.trace as TracePoint[])[0]).toEqual(P_A);
    const far: TracePoint = [P_A[0] + 0.2, P_A[1]];
    const refused = await saveTrace(dbA, {
      tronconId,
      trace: [far, P_B],
      source: "MANUEL",
      remplacerDistance: false,
    });
    expect(refused).toEqual({
      ok: false,
      error: "Le tracé doit partir de « Village A » et arriver à « Village B ».",
    });
  });

  it("validation : au moins deux points, coordonnées valides, 5 000 points au plus", () => {
    const base = { tronconId, source: "OSM", remplacerDistance: true };
    expect(saveTraceSchema.safeParse({ ...base, trace: [P_A] }).success).toBe(false);
    expect(saveTraceSchema.safeParse({ ...base, trace: [P_A, [200, 0]] }).success).toBe(false);
    expect(
      saveTraceSchema.safeParse({ ...base, trace: Array.from({ length: 5001 }, () => P_A) })
        .success,
    ).toBe(false);
  });

  it("effacer : retour à la ligne droite, distance inchangée", async () => {
    await saveTrace(dbA, { tronconId, trace, source: "OSM", remplacerDistance: true });
    const before = await raw.troncon.findUniqueOrThrow({ where: { id: tronconId } });
    expect((await clearTrace(dbA, tronconId)).ok).toBe(true);
    const t = await raw.troncon.findUniqueOrThrow({ where: { id: tronconId } });
    expect([t.trace, t.traceSource, t.distanceKm]).toEqual([null, null, before.distanceKm]);
  });
});

describe("proposer tous les tracés", () => {
  it("enregistre le tracé d'un tronçon sans tracé, ignore celui qui en a déjà un", async () => {
    const { fetcher, calls } = fakeOsrm();
    expect(await proposeAndSaveTrace(dbA, tronconId, fetcher)).toMatchObject({
      ok: true,
      data: { status: "enregistre" },
    });
    expect(await proposeAndSaveTrace(dbA, tronconId, fetcher)).toEqual({
      ok: true,
      data: { status: "deja" },
    });
    expect(calls).toHaveLength(1);
  });

  it("une distance mesurée sur le terrain est gardée", async () => {
    await raw.troncon.update({ where: { id: tronconId }, data: { distanceEstimee: false } });
    await proposeAndSaveTrace(dbA, tronconId, fakeOsrm().fetcher);
    const t = await raw.troncon.findUniqueOrThrow({ where: { id: tronconId } });
    expect([t.distanceKm, t.traceSource]).toEqual([3.7, "OSM"]);
  });
});

describe("affichage le long d'un itinéraire", () => {
  it("le calcul d'itinéraire renvoie le tracé réel, retourné si parcouru à l'envers", async () => {
    await saveTrace(dbA, {
      tronconId,
      trace: [P_A, BEND, P_B],
      source: "OSM",
      remplacerDistance: false,
    });
    const user = await raw.utilisateur.create({
      data: {
        agenceId: agenceA.id,
        prenom: "A",
        nom: "Admin",
        email: "admin@agence-a.test",
        motDePasseHash: "x",
        role: "ADMIN_AGENCE",
      },
    });
    const result = await computeItineraire(dbA, agenceA.id, user.id, {
      etapeDepartId: b,
      etapeArriveeId: a,
      etapesImposees: [],
      ordreLibre: false,
      critere: "PLUS_COURT",
      alpha: 1,
      beta: 0,
      gamma: 0,
      algorithme: "DIJKSTRA",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]!.geometry).toEqual({
      line: [
        [P_B[1], P_B[0]],
        [BEND[1], BEND[0]],
        [P_A[1], P_A[0]],
      ],
      traces: 1,
      legs: 1,
    });
  });
});

describe("isolation entre agences", () => {
  it("une autre agence ne peut ni proposer, ni enregistrer, ni effacer le tracé", async () => {
    const { fetcher, calls } = fakeOsrm();
    expect(await proposeTrace(dbB, tronconId, fetcher)).toEqual({
      ok: false,
      error: "Tronçon introuvable.",
    });
    expect(calls).toHaveLength(0);
    expect(
      await saveTrace(dbB, {
        tronconId,
        trace: [P_A, P_B],
        source: "MANUEL",
        remplacerDistance: true,
      }),
    ).toEqual({ ok: false, error: "Tronçon introuvable." });
    await saveTrace(dbA, {
      tronconId,
      trace: [P_A, BEND, P_B],
      source: "OSM",
      remplacerDistance: false,
    });
    expect(await clearTrace(dbB, tronconId)).toEqual({ ok: false, error: "Tronçon introuvable." });
    const t = await raw.troncon.findUniqueOrThrow({ where: { id: tronconId } });
    expect(t.traceSource).toBe("OSM");
  });
});
