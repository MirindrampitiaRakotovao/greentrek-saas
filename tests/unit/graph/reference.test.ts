import { describe, expect, it } from "vitest";

import { astar } from "@/lib/graph/astar";
import { buildGraph } from "@/lib/graph/build";
import { dijkstra } from "@/lib/graph/dijkstra";
import { pathToGeoJson } from "@/lib/graph/geojson";
import { haversineKm } from "@/lib/graph/haversine";
import { GraphError } from "@/lib/graph/types";
import { CRITERIA_PRESETS } from "@/lib/graph/weights";

import { REF_EDGES, REF_NODES } from "./reference-graph";

/** Graphe de référence : résultats calculés à la main (voir reference-graph.ts). */
const graph = buildGraph(REF_NODES, REF_EDGES);
const algorithms = [
  ["Dijkstra", dijkstra],
  ["A*", astar],
] as const;

describe.each(algorithms)("%s sur le graphe de référence", (_name, run) => {
  it("Plus court : A-B-D-F, 11 km", () => {
    const r = run(graph, "A", "F", CRITERIA_PRESETS.PLUS_COURT);
    expect(r.path).toEqual(["A", "B", "D", "F"]);
    expect(r.cost).toBeCloseTo(11, 10);
    expect(r.distanceKm).toBe(11);
    expect(r.dureeMinutes).toBe(160);
    expect(r.difficulteCumulee).toBe(4 * 1 + 5 * 1 + 2 * 5); // 19 km pondérés
    expect(r.difficulteMoyenne).toBeCloseTo(19 / 11, 10);
  });

  it("Plus rapide : A-C-E-F, 2,5 h", () => {
    const r = run(graph, "A", "F", CRITERIA_PRESETS.PLUS_RAPIDE);
    expect(r.path).toEqual(["A", "C", "E", "F"]);
    expect(r.cost).toBeCloseTo(2.5, 10);
    expect(r.dureeMinutes).toBe(150);
  });

  it("Plus facile : A-G-F, coût 12 (aucune pénalité)", () => {
    const r = run(graph, "A", "F", CRITERIA_PRESETS.PLUS_FACILE);
    expect(r.path).toEqual(["A", "G", "F"]);
    expect(r.cost).toBeCloseTo(12, 10);
  });

  it("dans l'autre sens (F → A), le chemin est inversé et le coût identique", () => {
    const r = run(graph, "F", "A", CRITERIA_PRESETS.PLUS_COURT);
    expect(r.path).toEqual(["F", "D", "B", "A"]);
    expect(r.cost).toBeCloseTo(11, 10);
  });

  it("§6.4 — aucun chemin vers une étape isolée : found = false, message possible", () => {
    const r = run(graph, "A", "H", CRITERIA_PRESETS.PLUS_COURT);
    expect(r.found).toBe(false);
    expect(r.path).toEqual([]);
    expect(r.cost).toBe(Infinity);
  });

  it("§6.4 — départ = arrivée : chemin d'une seule étape, coût 0", () => {
    const r = run(graph, "D", "D", CRITERIA_PRESETS.PLUS_COURT);
    expect(r).toMatchObject({ found: true, path: ["D"], cost: 0, distanceKm: 0, exploredCount: 1 });
  });

  it("§6.4 — graphe à un seul nœud", () => {
    const single = buildGraph([REF_NODES[0]!], []);
    expect(run(single, "A", "A", CRITERIA_PRESETS.PLUS_COURT)).toMatchObject({
      found: true,
      path: ["A"],
    });
  });

  it("§6.4 — étape inconnue (ex. supprimée) : erreur claire", () => {
    expect(() => run(graph, "A", "Z", CRITERIA_PRESETS.PLUS_COURT)).toThrow(GraphError);
  });
});

describe("comparaison Dijkstra / A* sur le graphe de référence", () => {
  it("A* n'explore pas plus de nœuds que Dijkstra, pour le même coût", () => {
    for (const criteria of Object.values(CRITERIA_PRESETS)) {
      const d = dijkstra(graph, "A", "F", criteria);
      const a = astar(graph, "A", "F", criteria);
      expect(a.cost).toBeCloseTo(d.cost, 10);
      expect(a.exploredCount).toBeLessThanOrEqual(d.exploredCount);
    }
  });

  it("les deux tronçons « pièges » sont bien plus courts que la ligne droite", () => {
    const [a, c, d, f] = ["A", "C", "D", "F"].map((id) => REF_NODES.find((n) => n.id === id)!);
    expect(haversineKm(a!, c!)).toBeGreaterThan(2);
    expect(haversineKm(d!, f!)).toBeGreaterThan(2);
  });
});

describe("§6.4 — validation des données et des critères", () => {
  it("refuse un tronçon vers une étape inexistante (étape supprimée)", () => {
    expect(() =>
      buildGraph(REF_NODES, [...REF_EDGES, { ...REF_EDGES[0]!, id: "X", to: "Z" }]),
    ).toThrow(/inexistante/);
  });

  it("refuse une boucle et un poids nul ou négatif (rejet à la saisie)", () => {
    expect(() => buildGraph(REF_NODES, [{ ...REF_EDGES[0]!, to: "A" }])).toThrow(/elle-même/);
    expect(() => buildGraph(REF_NODES, [{ ...REF_EDGES[0]!, distanceKm: 0 }])).toThrow(GraphError);
    expect(() => buildGraph(REF_NODES, [{ ...REF_EDGES[0]!, dureeMinutes: -5 }])).toThrow(
      GraphError,
    );
    expect(() => buildGraph(REF_NODES, [{ ...REF_EDGES[0]!, difficulte: 6 }])).toThrow(GraphError);
  });

  it("refuse des coefficients négatifs, ou α = β = 0 (poids nul possible)", () => {
    expect(() => dijkstra(graph, "A", "F", { alpha: -1, beta: 0, gamma: 0 })).toThrow(GraphError);
    expect(() => dijkstra(graph, "A", "F", { alpha: 0, beta: 0, gamma: 1 })).toThrow(GraphError);
  });

  it("tronçon dupliqué : le moins coûteux des deux est retenu", () => {
    const withDuplicate = buildGraph(REF_NODES, [
      ...REF_EDGES,
      {
        id: "AB-bis",
        from: "A",
        to: "B",
        distanceKm: 1,
        dureeMinutes: 20,
        difficulte: 1,
        bidirectionnel: true,
      },
    ]);
    const r = dijkstra(withDuplicate, "A", "F", CRITERIA_PRESETS.PLUS_COURT);
    expect(r.cost).toBeCloseTo(8, 10); // 1 + 5 + 2
    expect(r.arcs[0]!.edgeId).toBe("AB-bis");
  });

  it("tronçon à sens unique : praticable dans un seul sens", () => {
    const oneWay = buildGraph(REF_NODES, [
      {
        id: "AB",
        from: "A",
        to: "B",
        distanceKm: 4,
        dureeMinutes: 60,
        difficulte: 1,
        bidirectionnel: false,
      },
    ]);
    expect(dijkstra(oneWay, "A", "B", CRITERIA_PRESETS.PLUS_COURT).found).toBe(true);
    expect(dijkstra(oneWay, "B", "A", CRITERIA_PRESETS.PLUS_COURT).found).toBe(false);
  });
});

describe("tracé GeoJSON (§6.3)", () => {
  it("LineString en [longitude, latitude], dans l'ordre du chemin", () => {
    const r = dijkstra(graph, "A", "F", CRITERIA_PRESETS.PLUS_COURT);
    const geo = pathToGeoJson(graph, r.path);
    expect(geo.geometry.type).toBe("LineString");
    expect(geo.geometry.coordinates[0]).toEqual([49.4, -17.5]);
    expect(geo.geometry.coordinates).toHaveLength(4);
  });
});
