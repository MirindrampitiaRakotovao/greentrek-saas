import { buildGraph } from "@/lib/graph/build";
import { haversineKm } from "@/lib/graph/haversine";
import { heuristicParams } from "@/lib/graph/heuristic";
import { shortestPath } from "@/lib/graph/search";
import type { Criteria, Graph, GraphEdge, GraphNode } from "@/lib/graph/types";

/**
 * Banc d'essai (§6.5, décision D de l'E6) : graphes aléatoires GÉOMÉTRIQUES reproductibles
 * (même graine → même graphe), comparables à un réseau de sentiers :
 * - n points tirés uniformément dans un carré dont la surface croît avec n (densité
 *   constante, environ un lieu tous les 2 km) ;
 * - chaque point relié à ses k plus proches voisins, et au plus proche des points déjà
 *   placés (ce qui garantit un graphe connexe) ;
 * - distance d'un tronçon = vol d'oiseau × un facteur de sinuosité tiré entre 1,1 et 1,5 ;
 *   durée = distance à une vitesse tirée entre 3 et 5 km/h ; difficulté tirée de 1 à 5.
 * Pour chaque taille, on tire des paires (départ, arrivée) et on mesure les deux
 * algorithmes sur les MÊMES paires ; on retient la médiane des temps (robuste aux valeurs
 * extrêmes) et la moyenne des nœuds explorés.
 */

export function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Degrés de latitude par kilomètre (≈ 1 / 111,2). */
const DEG_PER_KM = 1 / 111.2;

export function randomGeometricGraph(size: number, seed: number, neighbours = 3): Graph {
  const random = createRandom(seed);
  const sideKm = Math.sqrt(size) * 2;
  const nodes: GraphNode[] = Array.from({ length: size }, (_, i) => ({
    id: `n${i}`,
    // Carré placé sur la côte Est de Madagascar (latitude −17,5°), en coordonnées réelles.
    latitude: -17.5 + random() * sideKm * DEG_PER_KM,
    longitude: 49.4 + random() * sideKm * DEG_PER_KM,
  }));

  // Grille de recherche des voisins (cellules de 4 km) : évite une comparaison O(n²).
  const cell = 4;
  const key = (node: GraphNode) =>
    `${Math.floor((node.latitude + 17.5) / DEG_PER_KM / cell)}:${Math.floor((node.longitude - 49.4) / DEG_PER_KM / cell)}`;
  const grid = new Map<string, number[]>();
  nodes.forEach((node, i) => grid.set(key(node), [...(grid.get(key(node)) ?? []), i]));
  const nearby = (i: number, radius: number) => {
    const node = nodes[i]!;
    const cy = Math.floor((node.latitude + 17.5) / DEG_PER_KM / cell);
    const cx = Math.floor((node.longitude - 49.4) / DEG_PER_KM / cell);
    const found: number[] = [];
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1)
        found.push(...(grid.get(`${cy + dy}:${cx + dx}`) ?? []));
    }
    return found.filter((j) => j !== i);
  };

  const pairs = new Set<string>();
  const add = (i: number, j: number) => pairs.add(i < j ? `${i}-${j}` : `${j}-${i}`);
  for (let i = 0; i < size; i += 1) {
    let candidates = nearby(i, 1);
    for (let r = 2; candidates.length < neighbours && r <= 8; r += 1) candidates = nearby(i, r);
    candidates
      .map((j) => ({ j, km: haversineKm(nodes[i]!, nodes[j]!) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, neighbours)
      .forEach(({ j }) => add(i, j));
    // Connexité : relier au plus proche des points déjà placés.
    if (i > 0) {
      let best = 0;
      let bestKm = Infinity;
      for (let j = 0; j < i; j += 1) {
        const km = haversineKm(nodes[i]!, nodes[j]!);
        if (km < bestKm) {
          bestKm = km;
          best = j;
        }
      }
      add(i, best);
    }
  }

  const edges: GraphEdge[] = [...pairs].map((pair, index) => {
    const [i, j] = pair.split("-").map(Number) as [number, number];
    const distanceKm = Math.max(0.01, haversineKm(nodes[i]!, nodes[j]!) * (1.1 + random() * 0.4));
    return {
      id: `e${index}`,
      from: `n${i}`,
      to: `n${j}`,
      distanceKm,
      dureeMinutes: Math.max(1, (distanceKm / (3 + random() * 2)) * 60),
      difficulte: 1 + Math.floor(random() * 5),
      bidirectionnel: true,
    };
  });
  return buildGraph(nodes, edges);
}

export type BenchmarkRow = {
  taille: number;
  arcs: number;
  paires: number;
  dijkstraTempsMedianMs: number;
  astarTempsMedianMs: number;
  dijkstraNoeudsMoyens: number;
  astarNoeudsMoyens: number;
  /** Réduction du nombre de nœuds explorés par A* (en %). */
  reductionNoeudsPct: number;
  /** Les deux algorithmes ont-ils trouvé le même coût sur toutes les paires ? */
  coutsIdentiques: boolean;
  /**
   * Prétraitement d'A* (calibrage de l'heuristique), payé UNE fois par graphe et non à
   * chaque recherche : mesuré à part pour une comparaison loyale.
   */
  calibrageAStarMs: number;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

export function runBenchmark(
  sizes: readonly number[],
  pairsPerSize: number,
  criteria: Criteria,
  seed = 2026,
): BenchmarkRow[] {
  return sizes.map((size, index) => {
    const graph = randomGeometricGraph(size, seed + index);
    const random = createRandom(seed * 31 + size);
    const ids = [...graph.nodes.keys()];
    const dTimes: number[] = [];
    const aTimes: number[] = [];
    let dNodes = 0;
    let aNodes = 0;
    let identical = true;
    // Prétraitement d'A*, mesuré à part (voir `calibrageAStarMs`).
    const tCalibrage = performance.now();
    heuristicParams(graph);
    const calibrageAStarMs = performance.now() - tCalibrage;
    // Un passage « à blanc » : le premier appel paie la compilation à la volée de JavaScript.
    shortestPath(graph, ids[0]!, ids[ids.length - 1]!, criteria, "DIJKSTRA");
    shortestPath(graph, ids[0]!, ids[ids.length - 1]!, criteria, "ASTAR");

    for (let p = 0; p < pairsPerSize; p += 1) {
      const start = ids[Math.floor(random() * ids.length)]!;
      const goal = ids[Math.floor(random() * ids.length)]!;
      const d = shortestPath(graph, start, goal, criteria, "DIJKSTRA");
      const a = shortestPath(graph, start, goal, criteria, "ASTAR");
      dTimes.push(d.timeMs);
      aTimes.push(a.timeMs);
      dNodes += d.exploredCount;
      aNodes += a.exploredCount;
      if (Math.abs(d.cost - a.cost) > 1e-9 * Math.max(1, d.cost)) identical = false;
    }

    let arcs = 0;
    for (const list of graph.adjacency.values()) arcs += list.length;
    const dijkstraNoeudsMoyens = dNodes / pairsPerSize;
    const astarNoeudsMoyens = aNodes / pairsPerSize;
    return {
      taille: size,
      arcs,
      paires: pairsPerSize,
      dijkstraTempsMedianMs: median(dTimes),
      astarTempsMedianMs: median(aTimes),
      dijkstraNoeudsMoyens,
      astarNoeudsMoyens,
      reductionNoeudsPct:
        dijkstraNoeudsMoyens > 0 ? (1 - astarNoeudsMoyens / dijkstraNoeudsMoyens) * 100 : 0,
      coutsIdentiques: identical,
      calibrageAStarMs,
    };
  });
}

/** Export CSV des résultats (séparateur « ; » et virgule décimale, pour Excel en français). */
export function benchmarkToCsv(rows: readonly BenchmarkRow[]): string {
  const header = [
    "taille",
    "arcs",
    "paires",
    "dijkstra_temps_median_ms",
    "astar_temps_median_ms",
    "dijkstra_noeuds_moyens",
    "astar_noeuds_moyens",
    "reduction_noeuds_pct",
    "couts_identiques",
    "calibrage_astar_ms",
  ];
  const format = (value: number) => value.toFixed(3).replace(".", ",");
  const lines = rows.map((r) =>
    [
      r.taille,
      r.arcs,
      r.paires,
      format(r.dijkstraTempsMedianMs),
      format(r.astarTempsMedianMs),
      format(r.dijkstraNoeudsMoyens),
      format(r.astarNoeudsMoyens),
      format(r.reductionNoeudsPct),
      r.coutsIdentiques ? "oui" : "non",
      format(r.calibrageAStarMs),
    ].join(";"),
  );
  return [header.join(";"), ...lines].join("\n");
}
