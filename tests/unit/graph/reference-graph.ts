import type { GraphEdge, GraphNode } from "@/lib/graph/types";

/**
 * GRAPHE DE RÉFÉRENCE (cahier des charges §6.5 bis et §11) : 8 nœuds, résultats calculés à
 * la main ci-dessous. Coordonnées fictives (valeurs de test, près de Mahambo).
 *
 *            B ───5 km─── D ──2 km, diff 5── F
 *          4 km            \               ╱ │
 *          ╱                8 km          ╱  3 km
 *         A ──2 km, diff 3── C ──10 km── E ─┘
 *          \                                  (+ A ─6 km─ G ─6 km─ F)
 *           H : isolé
 *
 *  Tronçon  distance  durée   difficulté   pénalité = (diff − 1) × distance
 *  A–B      4 km      60 min  1            0
 *  A–C      2 km      45 min  3            4
 *  B–D      5 km      70 min  1            0
 *  C–D      8 km      100 min 2            8
 *  C–E      10 km     70 min  1            0
 *  D–F      2 km      30 min  5            8
 *  E–F      3 km      35 min  1            0
 *  A–G      6 km      100 min 1            0
 *  G–F      6 km      100 min 1            0
 *
 *  Chemins de A vers F :
 *  chemin      distance   durée          pénalité   « Plus facile » = d + 2 × pénalité
 *  A-B-D-F     11 km      160 min        8          27
 *  A-C-D-F     12 km      175 min        20         52
 *  A-C-E-F     15 km      150 min (2,5 h) 4         23
 *  A-G-F       12 km      200 min        0          12
 *
 *  → Plus court  (α=1)        : A-B-D-F, coût 11
 *  → Plus rapide (β=1, heures) : A-C-E-F, coût 2,5
 *  → Plus facile (α=1, γ=2)   : A-G-F,   coût 12
 *  Trois critères, trois chemins optimaux différents.
 *
 *  Pièges volontaires pour A* : A–C (2 km) et D–F (2 km) sont PLUS COURTS que la distance à
 *  vol d'oiseau entre leurs extrémités (≈ 3 km et ≈ 3,8 km). Une heuristique « Haversine
 *  brute » surestimerait alors le coût restant ; l'heuristique calibrée sur les données ne
 *  le fait pas.
 */
export const REF_NODES: GraphNode[] = [
  { id: "A", latitude: -17.5, longitude: 49.4 },
  { id: "B", latitude: -17.47, longitude: 49.42 },
  { id: "C", latitude: -17.52, longitude: 49.42 },
  { id: "D", latitude: -17.48, longitude: 49.45 },
  { id: "E", latitude: -17.54, longitude: 49.46 },
  { id: "F", latitude: -17.5, longitude: 49.48 },
  { id: "G", latitude: -17.5, longitude: 49.44 },
  { id: "H", latitude: -17.6, longitude: 49.6 },
];

const edge = (
  from: string,
  to: string,
  distanceKm: number,
  dureeMinutes: number,
  difficulte: number,
): GraphEdge => ({
  id: `${from}${to}`,
  from,
  to,
  distanceKm,
  dureeMinutes,
  difficulte,
  bidirectionnel: true,
});

export const REF_EDGES: GraphEdge[] = [
  edge("A", "B", 4, 60, 1),
  edge("A", "C", 2, 45, 3),
  edge("B", "D", 5, 70, 1),
  edge("C", "D", 8, 100, 2),
  edge("C", "E", 10, 70, 1),
  edge("D", "F", 2, 30, 5),
  edge("E", "F", 3, 35, 1),
  edge("A", "G", 6, 100, 1),
  edge("G", "F", 6, 100, 1),
];
