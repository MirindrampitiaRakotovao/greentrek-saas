import {
  type Arc,
  type Graph,
  type GraphEdge,
  GraphError,
  type GraphNode,
} from "@/lib/graph/types";

/**
 * Construit la liste d'adjacence du graphe (§6.1) : un tronçon à double sens produit deux
 * arcs orientés. Les données incohérentes sont refusées avec un message clair (§6.4) :
 * tronçon vers une étape inexistante (ex. étape supprimée), boucle, poids invalide.
 * Un tronçon dupliqué ne gêne pas les algorithmes : ils retiennent naturellement le moins
 * coûteux des deux arcs parallèles.
 */
export function buildGraph(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): Graph {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, Arc[]>(nodes.map((node) => [node.id, []]));

  for (const edge of edges) {
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) {
      throw new GraphError(
        "NOEUD_INCONNU",
        `Le tronçon ${edge.id} relie une étape inexistante (supprimée ?).`,
      );
    }
    if (edge.from === edge.to) {
      throw new GraphError("BOUCLE", `Le tronçon ${edge.id} relie une étape à elle-même.`);
    }
    const valid =
      Number.isFinite(edge.distanceKm) &&
      edge.distanceKm > 0 &&
      Number.isFinite(edge.dureeMinutes) &&
      edge.dureeMinutes > 0 &&
      Number.isInteger(edge.difficulte) &&
      edge.difficulte >= 1 &&
      edge.difficulte <= 5;
    if (!valid) {
      throw new GraphError(
        "POIDS_INVALIDE",
        `Le tronçon ${edge.id} a une distance, une durée ou une difficulté invalide.`,
      );
    }

    const arc = (from: string, to: string): Arc => ({
      edgeId: edge.id,
      from,
      to,
      distanceKm: edge.distanceKm,
      dureeMinutes: edge.dureeMinutes,
      difficulte: edge.difficulte,
    });
    adjacency.get(edge.from)!.push(arc(edge.from, edge.to));
    if (edge.bidirectionnel) adjacency.get(edge.to)!.push(arc(edge.to, edge.from));
  }

  return { nodes: nodeMap, adjacency };
}

/** Nombre d'arcs orientés du graphe. */
export function arcCount(graph: Graph): number {
  let count = 0;
  for (const arcs of graph.adjacency.values()) count += arcs.length;
  return count;
}
