import { shortestPath } from "@/lib/graph/search";
import type { Criteria, Graph, PathResult } from "@/lib/graph/types";

/**
 * Algorithme de Dijkstra avec tas binaire (§6.2) : développe les nœuds par coût croissant
 * depuis le départ. Correct pour des poids positifs (garantis par la fonction de poids).
 * Implémentation commune avec A* (search.ts), avec une heuristique nulle.
 */
export function dijkstra(
  graph: Graph,
  startId: string,
  goalId: string,
  criteria: Criteria,
): PathResult {
  return shortestPath(graph, startId, goalId, criteria, "DIJKSTRA");
}
