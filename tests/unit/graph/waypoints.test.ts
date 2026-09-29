import { describe, expect, it } from "vitest";

import { createRandom, randomGeometricGraph } from "@/lib/graph/benchmark";
import { buildGraph } from "@/lib/graph/build";
import { dijkstra } from "@/lib/graph/dijkstra";
import type { Graph } from "@/lib/graph/types";
import { GraphError } from "@/lib/graph/types";
import { MAX_FREE_WAYPOINTS, shortestPathVia } from "@/lib/graph/waypoints";
import { CRITERIA_PRESETS } from "@/lib/graph/weights";

import { REF_EDGES, REF_NODES } from "./reference-graph";

const court = CRITERIA_PRESETS.PLUS_COURT;
const ref = buildGraph(REF_NODES, REF_EDGES);

/** Toutes les permutations (pour vérifier Held-Karp par force brute). */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

function bruteForceCost(graph: Graph, start: string, goal: string, waypoints: string[]) {
  let best = Infinity;
  for (const order of permutations(waypoints)) {
    const sequence = [start, ...order, goal];
    let total = 0;
    for (let i = 1; i < sequence.length; i += 1) {
      total += dijkstra(graph, sequence[i - 1]!, sequence[i]!, court).cost;
    }
    best = Math.min(best, total);
  }
  return best;
}

describe("étapes imposées — ordre fixé", () => {
  it("enchaîne les plus courts chemins : A → E → F passe par C puis E", () => {
    const r = shortestPathVia(ref, "A", "F", ["E"], court, "DIJKSTRA", { ordered: true });
    expect(r.path).toEqual(["A", "C", "E", "F"]);
    expect(r.cost).toBeCloseTo(2 + 10 + 3, 10);
    expect(r.order).toEqual(["E"]);
  });

  it("le coût est la somme des tronçons de l'itinéraire, qui est continu", () => {
    const r = shortestPathVia(ref, "A", "F", ["G", "B"], court, "ASTAR", { ordered: true });
    // A→G : 6 ; G→B : G-A-B = 10 (G-F-D-B = 13) ; B→F : B-D-F = 7. Total : 23.
    expect(r.cost).toBeCloseTo(23, 10);
    expect(r.path).toEqual(["A", "G", "A", "B", "D", "F"]);
    r.arcs.forEach((arc, i) => expect(arc.from).toBe(r.path[i]));
  });

  it("§6.4 — une étape imposée injoignable : found = false et tronçon manquant indiqué", () => {
    const r = shortestPathVia(ref, "A", "F", ["H"], court, "DIJKSTRA", { ordered: true });
    expect(r.found).toBe(false);
    expect(r.missingLeg).toEqual({ from: "A", to: "H" });
  });
});

describe("étapes imposées — ordre libre (Held-Karp)", () => {
  it("trouve le meilleur ordre sur le graphe de référence", () => {
    const r = shortestPathVia(ref, "A", "F", ["E", "B"], court, "DIJKSTRA", { ordered: false });
    expect(r.cost).toBeCloseTo(bruteForceCost(ref, "A", "F", ["E", "B"]), 10);
    expect(r.order).toEqual(["B", "E"]);
  });

  it("donne le même coût que l'essai de toutes les permutations (30 cas aléatoires)", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const graph = randomGeometricGraph(50, seed);
      const ids = [...graph.nodes.keys()];
      const random = createRandom(seed);
      const pick = () => ids[Math.floor(random() * ids.length)]!;
      const waypoints = [...new Set(Array.from({ length: 2 + (seed % 4) }, pick))];
      const [start, goal] = [pick(), pick()];
      for (const algorithm of ["DIJKSTRA", "ASTAR"] as const) {
        const r = shortestPathVia(graph, start, goal, waypoints, court, algorithm, {
          ordered: false,
        });
        expect(r.cost).toBeCloseTo(bruteForceCost(graph, start, goal, waypoints), 8);
        expect([...r.order].sort()).toEqual([...waypoints].sort()); // chaque étape une fois
      }
    }
  });

  it(`refuse plus de ${MAX_FREE_WAYPOINTS} étapes en ordre libre`, () => {
    const graph = randomGeometricGraph(40, 1);
    const nine = [...graph.nodes.keys()].slice(1, 10);
    expect(() =>
      shortestPathVia(graph, "n0", "n20", nine, court, "DIJKSTRA", { ordered: false }),
    ).toThrow(GraphError);
    // En ordre fixé, pas de limite (enchaînement linéaire).
    expect(
      shortestPathVia(graph, "n0", "n20", nine, court, "DIJKSTRA", { ordered: true }).found,
    ).toBe(true);
  });
});
