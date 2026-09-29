import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  computeItineraire,
  latestCircuitTrace,
  listHistorique,
  traceCircuit,
} from "@/lib/services/itineraires";
import { getTenantDb, type TenantDb } from "@/lib/tenant";
import type { ItineraireInput } from "@/lib/validators/itineraires";

import { REF_EDGES, REF_NODES } from "../unit/graph/reference-graph";
import { createTestClient, truncateAll } from "./test-db";

/**
 * Calcul d'itinéraire de bout en bout (étape E6b) : le graphe de référence (résultats
 * calculés à la main, tests/unit/graph/reference-graph.ts) est chargé dans la base de test.
 */
const raw = createTestClient();

afterAll(async () => {
  await raw.$disconnect();
});

let agenceA: { id: string };
let agenceB: { id: string };
let userId: string;
let dbA: TenantDb;
/** Identifiants en base des nœuds A…H du graphe de référence. */
const id: Record<string, string> = {};

beforeEach(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({ data: { nom: "Agence A", slug: "agence-a" } });
  agenceB = await raw.agence.create({ data: { nom: "Agence B", slug: "agence-b" } });
  const user = await raw.utilisateur.create({
    data: {
      agenceId: agenceA.id,
      email: "admin@a.test",
      nom: "Test",
      prenom: "Admin",
      motDePasseHash: "x",
      role: "ADMIN_AGENCE",
    },
  });
  userId = user.id;
  dbA = getTenantDb(agenceA.id, raw);
  for (const node of REF_NODES) {
    const etape = await raw.etape.create({
      data: {
        agenceId: agenceA.id,
        nom: node.id,
        type: "VILLAGE",
        latitude: node.latitude,
        longitude: node.longitude,
      },
    });
    id[node.id] = etape.id;
  }
  for (const edge of REF_EDGES) {
    await raw.troncon.create({
      data: {
        agenceId: agenceA.id,
        etapeDepartId: id[edge.from]!,
        etapeArriveeId: id[edge.to]!,
        distanceKm: edge.distanceKm,
        dureeMinutes: edge.dureeMinutes,
        difficulte: edge.difficulte,
        bidirectionnel: edge.bidirectionnel,
      },
    });
  }
});

const input = (overrides: Partial<ItineraireInput> = {}): ItineraireInput => ({
  etapeDepartId: id.A!,
  etapeArriveeId: id.F!,
  etapesImposees: [],
  ordreLibre: false,
  critere: "PLUS_COURT",
  alpha: 1,
  beta: 0,
  gamma: 0,
  algorithme: "DIJKSTRA",
  ...overrides,
});

describe("computeItineraire", () => {
  it("retrouve les résultats calculés à la main, pour chaque critère", async () => {
    const cases = [
      ["PLUS_COURT", ["A", "B", "D", "F"]],
      ["PLUS_RAPIDE", ["A", "C", "E", "F"]],
      ["PLUS_FACILE", ["A", "G", "F"]],
    ] as const;
    for (const [critere, expected] of cases) {
      const result = await computeItineraire(dbA, agenceA.id, userId, input({ critere }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0]!.path.map((s) => s.nom)).toEqual(expected);
    }
  });

  it("enregistre le calcul dans l'historique (chemin, métriques, auteur)", async () => {
    await computeItineraire(dbA, agenceA.id, userId, input({ algorithme: "ASTAR" }));
    const saved = await raw.itineraireCalcule.findFirstOrThrow();
    expect(saved).toMatchObject({
      agenceId: agenceA.id,
      algorithme: "ASTAR",
      critere: "PLUS_COURT",
      distanceTotaleKm: 11,
      dureeTotaleMin: 160,
      creeParId: userId,
    });
    expect(saved.noeudsExplores).toBeGreaterThan(0);
    const chemin = saved.cheminJson as {
      etapes: { nom: string }[];
      geojson: { geometry: { type: string } };
    };
    expect(chemin.etapes.map((e) => e.nom)).toEqual(["A", "B", "D", "F"]);
    expect(chemin.geojson.geometry.type).toBe("LineString");
    await expect(listHistorique(dbA, 1)).resolves.toMatchObject({ total: 1 });
  });

  it("« Comparer » lance les deux algorithmes : même coût, deux entrées d'historique", async () => {
    const result = await computeItineraire(
      dbA,
      agenceA.id,
      userId,
      input({ algorithme: "COMPARER" }),
    );
    if (!result.ok) throw new Error(result.error);
    const [d, a] = result.data;
    expect(d!.algorithme).toBe("DIJKSTRA");
    expect(a!.algorithme).toBe("ASTAR");
    expect(a!.cost).toBeCloseTo(d!.cost!, 10);
    expect(a!.exploredCount).toBeLessThanOrEqual(d!.exploredCount);
    await expect(raw.itineraireCalcule.count()).resolves.toBe(2);
  });

  it("critère personnalisé (α, β, γ)", async () => {
    const result = await computeItineraire(
      dbA,
      agenceA.id,
      userId,
      input({ critere: "PERSONNALISE", alpha: 0, beta: 1, gamma: 0 }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.data[0]!.path.map((s) => s.nom)).toEqual(["A", "C", "E", "F"]);
  });

  it("étapes imposées en ordre libre : ordre optimal retenu", async () => {
    const result = await computeItineraire(
      dbA,
      agenceA.id,
      userId,
      input({ etapesImposees: [id.E!, id.B!], ordreLibre: true }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.data[0]!.order).toEqual([id.B, id.E]);
  });

  it("§6.4 — aucun chemin : message clair, rien n'est enregistré", async () => {
    const result = await computeItineraire(
      dbA,
      agenceA.id,
      userId,
      input({ etapeArriveeId: id.H! }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.data[0]).toMatchObject({ found: false });
    expect(result.data[0]!.message).toMatch(/Aucun chemin entre « A » et « H »/);
    await expect(raw.itineraireCalcule.count()).resolves.toBe(0);
  });

  it("isolation : une étape d'une autre agence est introuvable", async () => {
    const etapeB = await raw.etape.create({
      data: { agenceId: agenceB.id, nom: "B", type: "VILLAGE", latitude: 0, longitude: 0 },
    });
    await expect(
      computeItineraire(dbA, agenceA.id, userId, input({ etapeArriveeId: etapeB.id })),
    ).resolves.toMatchObject({ ok: false });
  });
});

describe("tracé réel d'un circuit", () => {
  it("suit les tronçons dans l'ordre du circuit et met à jour distanceKm", async () => {
    const circuit = await raw.circuit.create({
      data: {
        agenceId: agenceA.id,
        titre: "Circuit",
        slug: "circuit",
        difficulte: "FACILE",
        dureeJours: 1,
        prixParPersonne: 1,
        capaciteMax: 5,
      },
    });
    // Étapes du circuit : A → D → F (A et D ne sont pas voisins : le tracé passe par B).
    for (const [ordre, nom] of ["A", "D", "F"].entries()) {
      await raw.circuitEtape.create({
        data: { circuitId: circuit.id, etapeId: id[nom]!, ordre: ordre + 1 },
      });
    }
    const result = await traceCircuit(dbA, agenceA.id, userId, circuit.id);
    if (!result.ok) throw new Error(result.error);
    expect(result.data.path.map((s) => s.nom)).toEqual(["A", "B", "D", "F"]);
    await expect(
      raw.circuit.findUniqueOrThrow({ where: { id: circuit.id } }),
    ).resolves.toMatchObject({
      distanceKm: 11,
    });
    await expect(latestCircuitTrace(dbA, circuit.id)).resolves.toMatchObject({
      distanceKm: 11,
      path: expect.arrayContaining([expect.objectContaining({ nom: "B" })]),
    });
  });
});
