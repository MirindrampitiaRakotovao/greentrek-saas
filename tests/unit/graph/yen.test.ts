import { describe, expect, it } from "vitest";

import { randomGeometricGraph } from "@/lib/graph/benchmark";
import { buildGraph } from "@/lib/graph/build";
import { pathCost } from "@/lib/graph/search";
import type { Arc, Criteria, Graph } from "@/lib/graph/types";
import { CRITERIA_PRESETS } from "@/lib/graph/weights";
import { kShortestPaths } from "@/lib/graph/yen";

import { REF_EDGES, REF_NODES } from "./reference-graph";

/**
 * Les K meilleurs itinéraires sans boucle (algorithme de Yen, étape 6b-3). Résultats attendus
 * sur le graphe de référence calculés à la main (voir reference-graph.ts).
 */
const ref = buildGraph(REF_NODES, REF_EDGES);
const COURT = CRITERIA_PRESETS.PLUS_COURT;

/** Tous les chemins sans boucle de `from` à `to`, par recherche exhaustive (petits graphes). */
function allSimplePaths(graph: Graph, from: string, to: string): Arc[][] {
  const out: Arc[][] = [];
  const walk = (node: string, visited: Set<string>, arcs: Arc[]) => {
    if (node === to) {
      out.push([...arcs]);
      return;
    }
    for (const arc of graph.adjacency.get(node) ?? []) {
      if (visited.has(arc.to)) continue;
      visited.add(arc.to);
      arcs.push(arc);
      walk(arc.to, visited, arcs);
      arcs.pop();
      visited.delete(arc.to);
    }
  };
  walk(from, new Set([from]), []);
  return out;
}

describe("algorithme de Yen : graphe de référence (calculé à la main)", () => {
  it("« Plus court » de A à F : 11, 12, 12, 15, 30 km, puis plus rien", () => {
    const { paths } = kShortestPaths(ref, "A", "F", COURT, 10);
    expect(paths.map((p) => p.cost)).toEqual([11, 12, 12, 15, 30]);
    expect(paths[0]!.path).toEqual(["A", "B", "D", "F"]);
    expect(new Set(paths.slice(1, 3).map((p) => p.path.join("")))).toEqual(
      new Set(["ACDF", "AGF"]),
    );
    expect(paths[3]!.path).toEqual(["A", "C", "E", "F"]);
    expect(paths[4]!.path).toEqual(["A", "B", "D", "C", "E", "F"]);
  });

  it("le 1er chemin est celui de Dijkstra ; les suivants sont plus longs ou égaux", () => {
    const { paths } = kShortestPaths(ref, "A", "F", CRITERIA_PRESETS.PLUS_RAPIDE, 3);
    expect(paths[0]!.path).toEqual(["A", "C", "E", "F"]);
    for (let i = 1; i < paths.length; i++) {
      expect(paths[i]!.cost).toBeGreaterThanOrEqual(paths[i - 1]!.cost);
    }
  });

  it("chaque chemin est continu, sans boucle, et son coût recalculé égale le coût annoncé", () => {
    const { paths } = kShortestPaths(ref, "A", "F", CRITERIA_PRESETS.PLUS_FACILE, 5);
    for (const p of paths) {
      expect(new Set(p.path).size).toBe(p.path.length);
      p.arcs.forEach((arc, i) => {
        expect(arc.from).toBe(p.path[i]);
        expect(arc.to).toBe(p.path[i + 1]);
      });
      expect(pathCost(p.arcs, CRITERIA_PRESETS.PLUS_FACILE)).toBeCloseTo(p.cost, 10);
    }
    expect(new Set(paths.map((p) => p.path.join(""))).size).toBe(paths.length);
  });

  it("cas limites : aucun chemin, départ = arrivée, K = 1", () => {
    expect(kShortestPaths(ref, "A", "H", COURT, 3).paths).toEqual([]);
    expect(kShortestPaths(ref, "A", "A", COURT, 3).paths).toHaveLength(1);
    expect(kShortestPaths(ref, "A", "F", COURT, 1).paths).toHaveLength(1);
  });
});

describe("algorithme de Yen : comparaison avec une recherche exhaustive", () => {
  it("sur 30 graphes aléatoires, mêmes K meilleurs coûts que l'énumération de tous les chemins", () => {
    const criteria: Criteria[] = [
      COURT,
      CRITERIA_PRESETS.PLUS_RAPIDE,
      CRITERIA_PRESETS.PLUS_FACILE,
    ];
    for (let seed = 1; seed <= 30; seed++) {
      const graph = randomGeometricGraph(9, seed, 3);
      const ids = [...graph.nodes.keys()];
      const [from, to] = [ids[0]!, ids.at(-1)!];
      const c = criteria[seed % 3]!;
      const expected = allSimplePaths(graph, from, to)
        .map((arcs) => pathCost(arcs, c))
        .sort((x, y) => x - y)
        .slice(0, 4);
      const got = kShortestPaths(graph, from, to, c, 4).paths.map((p) => p.cost);
      expect(got.length, `graine ${seed}`).toBe(expected.length);
      got.forEach((cost, i) =>
        expect(cost, `graine ${seed}, rang ${i + 1}`).toBeCloseTo(expected[i]!, 9),
      );
    }
  });
});

describe("choix de variantes bien distinctes", () => {
  it("garde les chemins qui dépassent le précédent montré d'au moins 3 % du meilleur coût", async () => {
    const { pickDistinct } = await import("@/lib/services/itineraires");
    const c = (cost: number) => ({ cost });
    // Meilleur : 100 ; 101 (+1 %) écarté ; 104 gardé ; 105 (+1 % de 104) écarté ; 110 gardé.
    expect(pickDistinct(100, [c(101), c(104), c(105), c(110), c(130)], 2)).toEqual([
      c(104),
      c(110),
    ]);
    expect(pickDistinct(100, [c(100.5)], 2)).toEqual([]);
  });
});
