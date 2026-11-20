import type { Prisma } from "@/generated/prisma/client";
import { buildGraph } from "@/lib/graph/build";
import { pathToGeoJson } from "@/lib/graph/geojson";
import { chainPathGeometry, type PathGeometry } from "@/lib/graph/trace";
import { type Algorithm, type Criteria, type Graph, GraphError } from "@/lib/graph/types";
import { shortestPathVia, type WaypointResult } from "@/lib/graph/waypoints";
import { CRITERIA_PRESETS } from "@/lib/graph/weights";
import { kShortestPaths } from "@/lib/graph/yen";
import { type Paginated, pageArgs, pageCount } from "@/lib/pagination";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import { loadTraceIndex } from "@/lib/services/troncon-traces";
import type { TenantDb } from "@/lib/tenant";
import type { ItineraireInput } from "@/lib/validators/itineraires";

/**
 * Calcul d'itinéraire sur le graphe de l'agence (§6.3) : charge les étapes et les tronçons
 * (client confiné : uniquement ceux de l'agence), construit le graphe, lance l'algorithme
 * (module pur `src/lib/graph/`) et enregistre le résultat dans l'historique
 * `ItineraireCalcule`, matière première des mesures du mémoire.
 */

export type PathStep = { id: string; nom: string; latitude: number; longitude: number };

/** Résultat d'un algorithme, sérialisable pour l'interface. */
export type AlgorithmOutcome = {
  algorithme: Algorithm;
  found: boolean;
  /** Message clair quand aucun itinéraire n'existe (§6.4). */
  message?: string;
  path: PathStep[];
  order: string[];
  cost: number | null;
  distanceKm: number;
  dureeMinutes: number;
  difficulteCumulee: number;
  difficulteMoyenne: number;
  exploredCount: number;
  /** Étapes explorées (pour les afficher sur la carte). */
  explored: string[];
  timeMs: number;
  historiqueId?: string;
  /** Tracé à afficher (étape 6b-2) : tracés réels des tronçons, sinon lignes droites. */
  geometry: PathGeometry;
  /**
   * Autres itinéraires, plus coûteux selon le critère (étape 6b-3, algorithme de Yen) :
   * seulement sans étape imposée, sur le premier résultat trouvé.
   */
  variantes?: VariantOutcome[];
};

/** Variante : un autre chemin réel du réseau, moins bon que l'optimum pour le critère. */
export type VariantOutcome = {
  /** 2 pour le 2e meilleur itinéraire, 3 pour le 3e… */
  rang: number;
  path: PathStep[];
  cost: number;
  distanceKm: number;
  dureeMinutes: number;
  difficulteMoyenne: number;
  geometry: PathGeometry;
};

/** Nombre de variantes montrées en plus du meilleur itinéraire. */
export const NOMBRE_VARIANTES = 2;
/** Chemins examinés par l'algorithme de Yen pour trouver des variantes bien distinctes. */
const CHEMINS_EXAMINES = 20;
/**
 * Écart minimal entre deux itinéraires montrés (3 % du coût du meilleur) : un chemin qui ne
 * fait qu'un petit crochet par un village voisin (+1 min) n'apporte rien au visiteur.
 */
export const ECART_MIN_VARIANTE = 0.03;

/** Choisit, dans l'ordre des coûts, les chemins qui s'écartent assez du précédent montré. */
export function pickDistinct<T extends { cost: number }>(
  bestCost: number,
  candidates: readonly T[],
  count: number,
  minGap: number = ECART_MIN_VARIANTE,
): T[] {
  const picked: T[] = [];
  let last = bestCost;
  for (const c of candidates) {
    if (picked.length >= count) break;
    if (c.cost >= last + minGap * bestCost) {
      picked.push(c);
      last = c.cost;
    }
  }
  return picked;
}

/** Graphe de l'agence construit à partir de la base (étapes = nœuds, tronçons = arêtes). */
export async function loadAgencyGraph(db: TenantDb): Promise<Graph> {
  const [etapes, troncons] = await Promise.all([
    db.etape.findMany({ select: { id: true, nom: true, latitude: true, longitude: true } }),
    db.troncon.findMany({
      select: {
        id: true,
        etapeDepartId: true,
        etapeArriveeId: true,
        distanceKm: true,
        dureeMinutes: true,
        difficulte: true,
        bidirectionnel: true,
      },
    }),
  ]);
  return buildGraph(
    etapes,
    troncons.map((t) => ({
      id: t.id,
      from: t.etapeDepartId,
      to: t.etapeArriveeId,
      distanceKm: t.distanceKm,
      dureeMinutes: t.dureeMinutes,
      difficulte: t.difficulte,
      bidirectionnel: t.bidirectionnel,
    })),
  );
}

export function criteriaFor(
  input: Pick<ItineraireInput, "critere" | "alpha" | "beta" | "gamma">,
): Criteria {
  return input.critere === "PERSONNALISE"
    ? { alpha: input.alpha, beta: input.beta, gamma: input.gamma }
    : CRITERIA_PRESETS[input.critere];
}

function toOutcome(graph: Graph, algorithme: Algorithm, result: WaypointResult): AlgorithmOutcome {
  const step = (id: string): PathStep => {
    const node = graph.nodes.get(id)!;
    return { id, nom: node.nom ?? id, latitude: node.latitude, longitude: node.longitude };
  };
  const nom = (id: string) => graph.nodes.get(id)?.nom ?? id;
  return {
    algorithme,
    found: result.found,
    message:
      result.found || !result.missingLeg
        ? undefined
        : `Aucun chemin entre « ${nom(result.missingLeg.from)} » et « ${nom(result.missingLeg.to)} » : ces étapes ne sont reliées par aucune suite de tronçons.`,
    path: result.path.map(step),
    order: result.order,
    cost: result.found ? result.cost : null,
    distanceKm: result.distanceKm,
    dureeMinutes: result.dureeMinutes,
    difficulteCumulee: result.difficulteCumulee,
    difficulteMoyenne: result.difficulteMoyenne,
    exploredCount: result.exploredCount,
    explored: [...new Set(result.explored)],
    timeMs: result.timeMs,
    geometry: { line: [], traces: 0, legs: 0 },
  };
}

/**
 * Calcule un itinéraire (un algorithme, ou les deux pour la comparaison) et enregistre
 * chaque résultat trouvé dans l'historique.
 */
export async function computeItineraire(
  db: TenantDb,
  agenceId: string,
  userId: string,
  input: ItineraireInput,
  options: { circuitId?: string } = {},
): Promise<ServiceResult<AlgorithmOutcome[]>> {
  const graph = await loadAgencyGraph(db);
  for (const id of [input.etapeDepartId, input.etapeArriveeId, ...input.etapesImposees]) {
    // Client confiné : une étape d'une autre agence est absente du graphe.
    if (!graph.nodes.has(id)) return failure("Étape introuvable dans le réseau de l'agence.");
  }

  const criteria = criteriaFor(input);
  const algorithms: Algorithm[] =
    input.algorithme === "COMPARER" ? ["DIJKSTRA", "ASTAR"] : [input.algorithme];

  const outcomes: AlgorithmOutcome[] = [];
  const traces = await loadTraceIndex(db);
  for (const algorithme of algorithms) {
    let result: WaypointResult;
    try {
      result = shortestPathVia(
        graph,
        input.etapeDepartId,
        input.etapeArriveeId,
        input.etapesImposees,
        criteria,
        algorithme,
        { ordered: !input.ordreLibre },
      );
    } catch (error: unknown) {
      if (error instanceof GraphError) return failure(error.message);
      throw error;
    }
    const outcome = toOutcome(graph, algorithme, result);
    outcome.geometry = chainPathGeometry(outcome.path, traces);

    if (outcome.found) {
      const saved = await db.itineraireCalcule.create({
        data: {
          agenceId,
          circuitId: options.circuitId ?? null,
          etapeDepartId: input.etapeDepartId,
          etapeArriveeId: input.etapeArriveeId,
          algorithme,
          critere: input.critere,
          alpha: criteria.alpha,
          beta: criteria.beta,
          gamma: criteria.gamma,
          // Instantané : le chemin reste lisible même si une étape est supprimée ensuite.
          cheminJson: {
            etapes: outcome.path,
            etapesImposees: input.etapesImposees,
            ordreLibre: input.ordreLibre,
            ordreRetenu: outcome.order,
            geojson: pathToGeoJson(graph, result.path),
          } satisfies Prisma.InputJsonValue,
          distanceTotaleKm: outcome.distanceKm,
          dureeTotaleMin: outcome.dureeMinutes,
          difficulteCumulee: outcome.difficulteCumulee,
          noeudsExplores: outcome.exploredCount,
          tempsCalculMs: outcome.timeMs,
          creeParId: userId,
        },
        select: { id: true },
      });
      outcome.historiqueId = saved.id;
    }
    outcomes.push(outcome);
  }

  // Variantes (algorithme de Yen) : sans étape imposée, pour le premier résultat trouvé.
  const best = outcomes.find((o) => o.found);
  if (best && input.etapesImposees.length === 0) {
    const shown = best.path.map((p) => p.id).join(">");
    const { paths } = kShortestPaths(
      graph,
      input.etapeDepartId,
      input.etapeArriveeId,
      criteria,
      CHEMINS_EXAMINES,
    );
    best.variantes = pickDistinct(
      best.cost ?? 0,
      paths.filter((p) => p.path.join(">") !== shown),
      NOMBRE_VARIANTES,
    ).map((p, index) => {
      const path = p.path.map((id) => {
        const node = graph.nodes.get(id)!;
        return { id, nom: node.nom ?? id, latitude: node.latitude, longitude: node.longitude };
      });
      return {
        rang: index + 2,
        path,
        cost: p.cost,
        distanceKm: p.distanceKm,
        dureeMinutes: p.dureeMinutes,
        difficulteMoyenne: p.difficulteMoyenne,
        geometry: chainPathGeometry(path, traces),
      };
    });
  }
  return success(outcomes);
}

/* ─── Historique ─────────────────────────────────────────────────────────────── */

const historiqueSelect = {
  id: true,
  algorithme: true,
  critere: true,
  distanceTotaleKm: true,
  dureeTotaleMin: true,
  noeudsExplores: true,
  tempsCalculMs: true,
  createdAt: true,
  etapeDepart: { select: { nom: true } },
  etapeArrivee: { select: { nom: true } },
  circuit: { select: { titre: true } },
  creePar: { select: { prenom: true, nom: true } },
} satisfies Prisma.ItineraireCalculeSelect;

export type HistoriqueRow = Prisma.ItineraireCalculeGetPayload<{ select: typeof historiqueSelect }>;

export async function listHistorique(
  db: TenantDb,
  page: number,
): Promise<Paginated<HistoriqueRow>> {
  const [items, total] = await Promise.all([
    db.itineraireCalcule.findMany({
      select: historiqueSelect,
      orderBy: { createdAt: "desc" },
      ...pageArgs(page, 10),
    }),
    db.itineraireCalcule.count(),
  ]);
  return { items, total, page, pageCount: pageCount(total, 10) };
}

/* ─── Tracé réel d'un circuit (décision E de l'E6) ───────────────────────────── */

export type CircuitTrace = {
  path: PathStep[];
  /** Tracé à afficher : tracés réels des tronçons enchaînés (étape 6b-2). */
  geometry: PathGeometry;
  distanceKm: number;
  dureeMinutes: number;
  createdAt: Date;
};

/**
 * Tracé réel d'un circuit : plus court chemin (A*, critère « Plus court ») passant par ses
 * étapes DANS L'ORDRE du circuit, à travers les tronçons. Met à jour `Circuit.distanceKm`
 * (le « cache calculé » du §5.2) et enregistre le calcul dans l'historique.
 */
export async function traceCircuit(
  db: TenantDb,
  agenceId: string,
  userId: string,
  circuitId: string,
): Promise<ServiceResult<AlgorithmOutcome>> {
  const circuit = await db.circuit.findUnique({
    where: { id: circuitId },
    select: { etapes: { orderBy: { ordre: "asc" }, select: { etapeId: true } } },
  });
  if (!circuit) return failure("Circuit introuvable.");
  const ids = circuit.etapes.map((e) => e.etapeId);
  if (ids.length < 2) return failure("Le circuit doit compter au moins deux étapes.");

  const result = await computeItineraire(
    db,
    agenceId,
    userId,
    {
      etapeDepartId: ids[0]!,
      etapeArriveeId: ids.at(-1)!,
      etapesImposees: ids.slice(1, -1),
      ordreLibre: false,
      critere: "PLUS_COURT",
      alpha: 1,
      beta: 0,
      gamma: 0,
      algorithme: "ASTAR",
    },
    { circuitId },
  );
  if (!result.ok) return result;
  const outcome = result.data[0]!;
  if (!outcome.found) return failure(outcome.message ?? "Aucun chemin pour ce circuit.");

  await db.circuit.update({
    where: { id: circuitId },
    data: { distanceKm: Math.round(outcome.distanceKm * 100) / 100 },
  });
  return success(outcome);
}

/** Dernier tracé réel enregistré pour un circuit (affiché sur sa carte). */
export async function latestCircuitTrace(
  db: TenantDb,
  circuitId: string,
): Promise<CircuitTrace | null> {
  const last = await db.itineraireCalcule.findFirst({
    where: { circuitId },
    orderBy: { createdAt: "desc" },
    select: { cheminJson: true, distanceTotaleKm: true, dureeTotaleMin: true, createdAt: true },
  });
  if (!last) return null;
  const etapes = (last.cheminJson as { etapes?: PathStep[] } | null)?.etapes;
  if (!Array.isArray(etapes)) return null;
  return {
    path: etapes,
    geometry: chainPathGeometry(etapes, await loadTraceIndex(db)),
    distanceKm: last.distanceTotaleKm,
    dureeMinutes: last.dureeTotaleMin,
    createdAt: last.createdAt,
  };
}
