import { describe, expect, it } from "vitest";

import { benchmarkToCsv, randomGeometricGraph, runBenchmark } from "@/lib/graph/benchmark";
import { dijkstra } from "@/lib/graph/dijkstra";
import { CRITERIA_PRESETS } from "@/lib/graph/weights";

describe("graphes aléatoires du benchmark", () => {
  it("sont reproductibles : même graine → même graphe", () => {
    const a = randomGeometricGraph(80, 42);
    const b = randomGeometricGraph(80, 42);
    expect([...a.nodes.values()]).toEqual([...b.nodes.values()]);
    expect([...a.adjacency.entries()]).toEqual([...b.adjacency.entries()]);
  });

  it("sont connexes (chaque nœud atteignable depuis le premier)", () => {
    for (const size of [50, 200]) {
      const graph = randomGeometricGraph(size, size);
      for (const id of graph.nodes.keys()) {
        expect(dijkstra(graph, "n0", id, CRITERIA_PRESETS.PLUS_COURT).found).toBe(true);
      }
    }
  });

  it("ont la taille demandée et environ 2 à 4 tronçons par nœud", () => {
    const graph = randomGeometricGraph(1000, 1);
    expect(graph.nodes.size).toBe(1000);
    let arcs = 0;
    for (const list of graph.adjacency.values()) arcs += list.length;
    expect(arcs / 2 / 1000).toBeGreaterThan(1.5);
    expect(arcs / 2 / 1000).toBeLessThan(5);
  });
});

describe("runBenchmark", () => {
  const rows = runBenchmark([50, 200], 10, CRITERIA_PRESETS.PLUS_COURT);

  it("mesure les deux algorithmes sur les mêmes paires, avec des coûts identiques", () => {
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.coutsIdentiques).toBe(true);
      expect(row.paires).toBe(10);
      expect(row.astarNoeudsMoyens).toBeLessThanOrEqual(row.dijkstraNoeudsMoyens);
      expect(row.dijkstraTempsMedianMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("exporte un CSV lisible par Excel en français (« ; » et virgule décimale)", () => {
    const csv = benchmarkToCsv(rows).split("\n");
    expect(csv).toHaveLength(3);
    expect(csv[0]).toContain("taille;arcs;paires");
    expect(csv[1]).toMatch(/^50;\d+;10;\d+,\d{3};/);
  });
});
