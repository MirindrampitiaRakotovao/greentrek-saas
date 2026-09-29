/**
 * Types du module de graphe (cahier des charges §6). Aucune dépendance à la base de
 * données ni à l'interface : le module ne manipule que ces structures.
 */

/** Nœud : une étape (§6.1). */
export type GraphNode = {
  id: string;
  latitude: number;
  longitude: number;
  nom?: string;
};

/** Arête : un tronçon (§6.1). À double sens, il produit deux arcs orientés. */
export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  distanceKm: number;
  dureeMinutes: number;
  /** 1 (très facile) à 5 (très difficile). */
  difficulte: number;
  bidirectionnel: boolean;
};

/** Arc orienté sortant d'un nœud. */
export type Arc = {
  edgeId: string;
  from: string;
  to: string;
  distanceKm: number;
  dureeMinutes: number;
  difficulte: number;
};

export type Graph = {
  nodes: ReadonlyMap<string, GraphNode>;
  /** Liste d'adjacence : pour chaque nœud, ses arcs sortants. */
  adjacency: ReadonlyMap<string, readonly Arc[]>;
};

/** Coefficients de la fonction de poids w(e) = α·d + β·t + γ·pénalité (§6.1). */
export type Criteria = { alpha: number; beta: number; gamma: number };

export type Algorithm = "DIJKSTRA" | "ASTAR";

/** Résultat d'une recherche de plus court chemin (sorties exigées au §6.3). */
export type PathResult = {
  found: boolean;
  /** Identifiants des nœuds, du départ à l'arrivée (vide si aucun chemin). */
  path: string[];
  /** Arcs empruntés, dans l'ordre. */
  arcs: Arc[];
  cost: number;
  distanceKm: number;
  dureeMinutes: number;
  /** Σ difficulté × distance (km pondérés par la difficulté). */
  difficulteCumulee: number;
  /** Difficulté moyenne pondérée par la distance (1 à 5), 0 si chemin vide. */
  difficulteMoyenne: number;
  /** Nombre de nœuds définitivement traités (sortis de la file et développés). */
  exploredCount: number;
  /** Nœuds traités, dans l'ordre (pour les montrer sur la carte). */
  explored: string[];
  timeMs: number;
};

/** Erreur de données ou de paramètres, avec un message clair en français (§6.4). */
export class GraphError extends Error {
  constructor(
    public readonly code:
      "NOEUD_INCONNU" | "BOUCLE" | "POIDS_INVALIDE" | "CRITERES_INVALIDES" | "TROP_D_ETAPES",
    message: string,
  ) {
    super(message);
    this.name = "GraphError";
  }
}
