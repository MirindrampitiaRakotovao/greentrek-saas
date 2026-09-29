import { buildHeuristic } from "@/lib/graph/heuristic";
import { MinHeap } from "@/lib/graph/priority-queue";
import type { Algorithm, Arc, Criteria, Graph, PathResult } from "@/lib/graph/types";
import { GraphError } from "@/lib/graph/types";
import { arcWeight, validateCriteria } from "@/lib/graph/weights";

/**
 * Recherche du chemin de coût minimal entre deux étapes (§6.2).
 *
 * Un seul moteur pour les deux algorithmes : A* est Dijkstra guidé par une heuristique h.
 * La file est ordonnée par f(n) = g(n) + h(n), où g(n) est le coût connu depuis le départ.
 * - Dijkstra : h(n) = 0 ;
 * - A* : h(n) = estimation admissible et cohérente du coût restant (heuristic.ts).
 * Partager le code rend la comparaison équitable (mêmes structures, même file) : seule
 * l'heuristique change, et donc le nombre de nœuds explorés.
 *
 * « Nœud exploré » : nœud sorti de la file et développé (ses voisins sont examinés).
 * La recherche s'arrête dès que l'arrivée sort de la file (son coût est alors définitif).
 */
export function shortestPath(
  graph: Graph,
  startId: string,
  goalId: string,
  criteria: Criteria,
  algorithm: Algorithm,
): PathResult {
  validateCriteria(criteria);
  for (const id of [startId, goalId]) {
    if (!graph.nodes.has(id)) {
      throw new GraphError("NOEUD_INCONNU", `L'étape ${id} n'existe pas dans le graphe.`);
    }
  }

  const t0 = performance.now();
  const h = algorithm === "ASTAR" ? buildHeuristic(graph, goalId, criteria) : () => 0;

  const g = new Map<string, number>([[startId, 0]]); // meilleur coût connu depuis le départ
  const via = new Map<string, Arc>(); // arc par lequel on atteint chaque nœud
  const settled = new Set<string>(); // nœuds dont le coût est définitif
  const explored: string[] = [];
  const open = new MinHeap<string>();
  open.push(startId, h(startId));

  while (open.size > 0) {
    const { value: current } = open.pop()!;
    if (settled.has(current)) continue; // entrée périmée (nœud déjà traité)
    settled.add(current);
    explored.push(current);
    if (current === goalId) break;

    const gCurrent = g.get(current)!;
    for (const arc of graph.adjacency.get(current) ?? []) {
      if (settled.has(arc.to)) continue;
      const candidate = gCurrent + arcWeight(arc, criteria);
      if (candidate < (g.get(arc.to) ?? Infinity)) {
        g.set(arc.to, candidate);
        via.set(arc.to, arc);
        open.push(arc.to, candidate + h(arc.to));
      }
    }
  }

  const timeMs = performance.now() - t0;
  if (!settled.has(goalId)) return emptyResult(explored, timeMs);

  // Reconstitution du chemin en remontant les arcs depuis l'arrivée.
  const arcs: Arc[] = [];
  for (let node = goalId; node !== startId;) {
    const arc = via.get(node)!;
    arcs.push(arc);
    node = arc.from;
  }
  arcs.reverse();
  return summarize(startId, arcs, g.get(goalId)!, explored, timeMs);
}

/** Totaux d'un chemin donné par ses arcs (distance, durée, difficulté). */
export function summarize(
  startId: string,
  arcs: readonly Arc[],
  cost: number,
  explored: string[],
  timeMs: number,
): PathResult {
  const distanceKm = arcs.reduce((sum, arc) => sum + arc.distanceKm, 0);
  const difficulteCumulee = arcs.reduce((sum, arc) => sum + arc.difficulte * arc.distanceKm, 0);
  return {
    found: true,
    path: [startId, ...arcs.map((arc) => arc.to)],
    arcs: [...arcs],
    cost,
    distanceKm,
    dureeMinutes: arcs.reduce((sum, arc) => sum + arc.dureeMinutes, 0),
    difficulteCumulee,
    difficulteMoyenne: distanceKm > 0 ? difficulteCumulee / distanceKm : 0,
    exploredCount: explored.length,
    explored,
    timeMs,
  };
}

function emptyResult(explored: string[], timeMs: number): PathResult {
  return {
    found: false,
    path: [],
    arcs: [],
    cost: Infinity,
    distanceKm: 0,
    dureeMinutes: 0,
    difficulteCumulee: 0,
    difficulteMoyenne: 0,
    exploredCount: explored.length,
    explored,
    timeMs,
  };
}

/** Coût d'un chemin recalculé arc par arc (pour les tests : doit égaler le coût annoncé). */
export function pathCost(arcs: readonly Arc[], criteria: Criteria): number {
  return arcs.reduce((sum, arc) => sum + arcWeight(arc, criteria), 0);
}
