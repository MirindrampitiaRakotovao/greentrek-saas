import type { Prisma } from "@/generated/prisma/client";
import { buildGraph } from "@/lib/graph/build";
import { pathToGeoJson } from "@/lib/graph/geojson";
import { type Algorithm, type Criteria, type Graph, GraphError } from "@/lib/graph/types";
import { shortestPathVia, type WaypointResult } from "@/lib/graph/waypoints";
import { CRITERIA_PRESETS } from "@/lib/graph/weights";
import { type Paginated, pageArgs, pageCount } from "@/lib/pagination";
import { failure, type ServiceResult, success } from "@/lib/services/result";
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
};

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
    distanceKm: last.distanceTotaleKm,
    dureeMinutes: last.dureeTotaleMin,
    createdAt: last.createdAt,
  };
}
