import { shortestPath, summarize } from "@/lib/graph/search";
import { MinHeap } from "@/lib/graph/priority-queue";
import type { Arc, Criteria, Graph, PathResult } from "@/lib/graph/types";
import { arcWeight } from "@/lib/graph/weights";

/**
 * Les K meilleurs itinéraires sans boucle (étape 6b-3, demande de l'étudiant : montrer aussi
 * des solutions plus lentes que l'optimum) : algorithme de Yen (J. Y. Yen, « Finding the K
 * shortest loopless paths in a network », Management Science, 1971).
 *
 * Principe : le 1er chemin est le plus court (Dijkstra). Pour trouver le k-ième, on reprend
 * le (k−1)-ième et, pour chaque nœud i de ce chemin (« nœud de déviation ») :
 *   - la « racine » est le début du chemin jusqu'à i ;
 *   - on interdit l'arc qui suit i dans tous les chemins déjà retenus ayant la même racine
 *     (sinon on retrouverait un chemin connu) ;
 *   - on interdit les nœuds de la racine (sauf i) : le chemin reste sans boucle ;
 *   - on calcule le plus court chemin de i à l'arrivée dans ce graphe réduit (Dijkstra) ;
 *   - racine + ce chemin forment un candidat.
 * Le meilleur candidat (coût minimal, pas encore retenu) devient le k-ième chemin.
 *
 * Complexité : K × (longueur du chemin) recherches de Dijkstra, soit O(K·n·(m + n log n)) :
 * négligeable sur un réseau d'agence (quelques dizaines d'étapes). Fonction pure, testée.
 */

export type KShortestResult = {
  /** Chemins du moins coûteux au plus coûteux (le 1er est l'optimum). */
  paths: PathResult[];
  /** Nombre de recherches de Dijkstra lancées (mesure pour le mémoire). */
  searches: number;
  timeMs: number;
};

/** Identifiant d'un arc orienté (un tronçon à double sens donne deux arcs). */
const arcKey = (arc: Pick<Arc, "edgeId" | "from" | "to">) => `${arc.edgeId}:${arc.from}>${arc.to}`;
const pathKey = (arcs: readonly Arc[]) => arcs.map(arcKey).join("|");

/** Graphe réduit : sans certains arcs orientés ni certains nœuds (sauf pour les nœuds gardés). */
function reducedGraph(
  graph: Graph,
  removedArcs: ReadonlySet<string>,
  removedNodes: ReadonlySet<string>,
): Graph {
  const adjacency = new Map<string, readonly Arc[]>();
  for (const [node, arcs] of graph.adjacency) {
    if (removedNodes.has(node)) continue;
    adjacency.set(
      node,
      arcs.filter((arc) => !removedArcs.has(arcKey(arc)) && !removedNodes.has(arc.to)),
    );
  }
  return { nodes: graph.nodes, adjacency };
}

export function kShortestPaths(
  graph: Graph,
  startId: string,
  goalId: string,
  criteria: Criteria,
  k: number,
): KShortestResult {
  const t0 = performance.now();
  let searches = 1;
  const first = shortestPath(graph, startId, goalId, criteria, "DIJKSTRA");
  if (!first.found || startId === goalId || k <= 1) {
    return { paths: first.found ? [first] : [], searches, timeMs: performance.now() - t0 };
  }

  const accepted: PathResult[] = [first];
  const seen = new Set<string>([pathKey(first.arcs)]);
  const candidates = new MinHeap<Arc[]>();

  while (accepted.length < k) {
    const previous = accepted.at(-1)!;
    for (let i = 0; i < previous.path.length - 1; i++) {
      const spurNode = previous.path[i]!;
      const rootArcs = previous.arcs.slice(0, i);
      const rootKey = pathKey(rootArcs);

      const removedArcs = new Set<string>();
      for (const p of accepted) {
        if (p.arcs.length > i && pathKey(p.arcs.slice(0, i)) === rootKey) {
          removedArcs.add(arcKey(p.arcs[i]!));
        }
      }
      const removedNodes = new Set(previous.path.slice(0, i));

      searches++;
      const spur = shortestPath(
        reducedGraph(graph, removedArcs, removedNodes),
        spurNode,
        goalId,
        criteria,
        "DIJKSTRA",
      );
      if (!spur.found) continue;
      const arcs = [...rootArcs, ...spur.arcs];
      const key = pathKey(arcs);
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(
        arcs,
        arcs.reduce((sum, arc) => sum + arcWeight(arc, criteria), 0),
      );
    }
    const next = candidates.pop();
    if (!next) break; // plus aucun autre chemin
    accepted.push(summarize(startId, next.value, next.priority, [], 0));
  }
  return { paths: accepted, searches, timeMs: performance.now() - t0 };
}
