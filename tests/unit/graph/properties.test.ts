import { describe, expect, it } from "vitest";

import { astar } from "@/lib/graph/astar";
import { createRandom, randomGeometricGraph } from "@/lib/graph/benchmark";
import { buildGraph } from "@/lib/graph/build";
import { dijkstra } from "@/lib/graph/dijkstra";
import { haversineKm } from "@/lib/graph/haversine";
import { buildHeuristic, heuristicParams } from "@/lib/graph/heuristic";
import { MinHeap } from "@/lib/graph/priority-queue";
import { pathCost } from "@/lib/graph/search";
import type { Criteria, Graph } from "@/lib/graph/types";
import { arcWeight, CRITERIA_PRESETS } from "@/lib/graph/weights";

import { REF_EDGES, REF_NODES } from "./reference-graph";

/** Propriétés vérifiées sur de nombreux graphes aléatoires reproductibles (§6.5 bis). */
const PRESETS: [string, Criteria][] = [
  ...Object.entries(CRITERIA_PRESETS),
  ["PERSONNALISE", { alpha: 0.7, beta: 2.3, gamma: 0.5 }],
];

describe("tas binaire", () => {
  it("rend les éléments par priorité croissante (1 000 valeurs aléatoires)", () => {
    const random = createRandom(7);
    const heap = new MinHeap<number>();
    const values = Array.from({ length: 1000 }, () => random());
    values.forEach((v) => heap.push(v, v));
    const out: number[] = [];
    while (heap.size > 0) out.push(heap.pop()!.value);
    expect(out).toEqual([...values].sort((a, b) => a - b));
    expect(heap.pop()).toBeUndefined();
  });
});

describe("Dijkstra et A* : même coût optimal sur des graphes aléatoires", () => {
  it.each(PRESETS)("critère %s : 60 graphes × 5 paires", (_name, criteria) => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const graph = randomGeometricGraph(40 + (seed % 5) * 30, seed);
      const ids = [...graph.nodes.keys()];
      const random = createRandom(seed * 97);
      for (let p = 0; p < 5; p += 1) {
        const start = ids[Math.floor(random() * ids.length)]!;
        const goal = ids[Math.floor(random() * ids.length)]!;
        const d = dijkstra(graph, start, goal, criteria);
        const a = astar(graph, start, goal, criteria);
        expect(a.found).toBe(d.found);
        expect(a.cost).toBeCloseTo(d.cost, 8);
      }
    }
  });
});

describe("validité du chemin renvoyé", () => {
  it("chemin continu (chaque arc part de l'étape précédente) et coût recalculé = coût annoncé", () => {
    for (let seed = 100; seed < 130; seed += 1) {
      const graph = randomGeometricGraph(120, seed);
      const ids = [...graph.nodes.keys()];
      for (const [, criteria] of PRESETS) {
        for (const run of [dijkstra, astar]) {
          const r = run(graph, ids[0]!, ids[ids.length - 1]!, criteria);
          expect(r.found).toBe(true);
          expect(r.path[0]).toBe(ids[0]);
          expect(r.path.at(-1)).toBe(ids[ids.length - 1]);
          r.arcs.forEach((arc, i) => {
            expect(arc.from).toBe(r.path[i]);
            expect(arc.to).toBe(r.path[i + 1]);
            // L'arc existe bien dans le graphe (on ne « saute » pas entre deux étapes).
            expect(
              graph.adjacency
                .get(arc.from)!
                .some((x) => x.edgeId === arc.edgeId && x.to === arc.to),
            ).toBe(true);
          });
          expect(pathCost(r.arcs, criteria)).toBeCloseTo(r.cost, 8);
        }
      }
    }
  });

  it("A* explore en moyenne nettement moins de nœuds que Dijkstra", () => {
    let dTotal = 0;
    let aTotal = 0;
    for (let seed = 200; seed < 240; seed += 1) {
      const graph = randomGeometricGraph(300, seed);
      const ids = [...graph.nodes.keys()];
      const d = dijkstra(graph, ids[0]!, ids[150]!, CRITERIA_PRESETS.PLUS_COURT);
      const a = astar(graph, ids[0]!, ids[150]!, CRITERIA_PRESETS.PLUS_COURT);
      dTotal += d.exploredCount;
      aTotal += a.exploredCount;
    }
    expect(aTotal).toBeLessThan(dTotal * 0.8);
  });
});

/** Vrai coût restant de chaque nœud vers `goal` (Dijkstra depuis chaque nœud). */
function trueCosts(graph: Graph, goal: string, criteria: Criteria) {
  return new Map(
    [...graph.nodes.keys()].map((id) => [id, dijkstra(graph, id, goal, criteria).cost]),
  );
}

describe("heuristique d'A* : admissible et cohérente (§6.2)", () => {
  const check = (graph: Graph, goal: string, criteria: Criteria) => {
    const h = buildHeuristic(graph, goal, criteria);
    expect(h(goal)).toBe(0);
    for (const [id, cost] of trueCosts(graph, goal, criteria)) {
      if (Number.isFinite(cost)) expect(h(id)).toBeLessThanOrEqual(cost + 1e-9); // admissible
    }
    for (const arcs of graph.adjacency.values()) {
      for (const arc of arcs) {
        // cohérente : h(u) ≤ w(u, v) + h(v)
        expect(h(arc.from)).toBeLessThanOrEqual(arcWeight(arc, criteria) + h(arc.to) + 1e-9);
      }
    }
  };

  it("sur le graphe de référence, pour chaque critère et chaque arrivée", () => {
    const graph = buildGraph(REF_NODES, REF_EDGES);
    for (const [, criteria] of PRESETS)
      for (const goal of graph.nodes.keys()) check(graph, goal, criteria);
  });

  it("sur 20 graphes aléatoires", () => {
    for (let seed = 300; seed < 320; seed += 1) {
      const graph = randomGeometricGraph(60, seed);
      for (const [, criteria] of PRESETS) check(graph, "n0", criteria);
    }
  });

  it("une heuristique « Haversine brute » serait NON admissible sur le graphe de référence", () => {
    // Coût réel D → F (plus court) = 2 km, mais la ligne droite D–F mesure ≈ 3,8 km.
    const graph = buildGraph(REF_NODES, REF_EDGES);
    const [d, f] = ["D", "F"].map((id) => graph.nodes.get(id)!);
    expect(haversineKm(d!, f!)).toBeGreaterThan(
      dijkstra(graph, "D", "F", CRITERIA_PRESETS.PLUS_COURT).cost,
    );
    // D'où le calibrage ρ < 1 calculé sur les données.
    expect(heuristicParams(graph).ratioMin).toBeLessThan(1);
  });
});
