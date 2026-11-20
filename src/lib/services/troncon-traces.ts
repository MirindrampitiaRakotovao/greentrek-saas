import { Prisma } from "@/generated/prisma/client";
import { estimateDurationMinutes } from "@/lib/graph/estimation";
import { haversineKm } from "@/lib/graph/haversine";
import {
  attachEndpoints,
  roundedLengthKm,
  type StoredTrace,
  type TracePoint,
  traceIndex,
} from "@/lib/graph/trace";
import { fetchFootRoute } from "@/lib/osm-routing";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import type { TenantDb } from "@/lib/tenant";
import type { SaveTraceInput } from "@/lib/validators/circuits";

/**
 * Tracés réels des tronçons (étape 6b-2, choix (a) de l'étudiant) :
 * - proposition à partir des chemins d'OpenStreetMap, que l'agence valide ou annule ;
 * - tracé dessiné ou corrigé à la main ;
 * - « Remplacer la distance par la longueur du tracé » : distance = longueur du tracé, durée
 *   recalculée par la règle de Naismith adaptée. `distanceEstimee` ne change PAS : la
 *   longueur d'un tracé OSM n'est pas un relevé de terrain (l'interface indique « mesurée
 *   sur le tracé »).
 * Les algorithmes ne lisent jamais le tracé, seulement `distanceKm`.
 */

const tronconWithEnds = {
  id: true,
  distanceKm: true,
  dureeMinutes: true,
  distanceEstimee: true,
  deniveleM: true,
  trace: true,
  traceSource: true,
  etapeDepart: { select: { nom: true, latitude: true, longitude: true } },
  etapeArrivee: { select: { nom: true, latitude: true, longitude: true } },
} satisfies Prisma.TronconSelect;

/** Écart toléré entre l'extrémité d'un tracé et son étape (les points sont ensuite recollés). */
const MAX_ENDPOINT_GAP_KM = 1;

export type TraceProposal = {
  trace: TracePoint[];
  longueurKm: number;
  distanceActuelleKm: number;
  distanceEstimee: boolean;
  /** Distance (m) entre chaque étape et le premier chemin connu d'OSM. */
  accrocheM: [number, number];
};

function getWithEnds(db: TenantDb, id: string) {
  return db.troncon.findUnique({ where: { id }, select: tronconWithEnds });
}

/** Demande à OpenStreetMap le chemin à pied du tronçon (rien n'est enregistré). */
export async function proposeTrace(
  db: TenantDb,
  tronconId: string,
  fetcher: typeof fetch = fetch,
): Promise<ServiceResult<TraceProposal>> {
  const troncon = await getWithEnds(db, tronconId);
  if (!troncon) return failure("Tronçon introuvable.");
  const from: TracePoint = [troncon.etapeDepart.longitude, troncon.etapeDepart.latitude];
  const to: TracePoint = [troncon.etapeArrivee.longitude, troncon.etapeArrivee.latitude];
  const result = await fetchFootRoute(from, to, fetcher);
  if (!result.ok) return failure(result.error);
  const trace = attachEndpoints(result.route.coordinates, from, to);
  return success({
    trace,
    longueurKm: roundedLengthKm(trace),
    distanceActuelleKm: troncon.distanceKm,
    distanceEstimee: troncon.distanceEstimee,
    accrocheM: result.route.accrocheM,
  });
}

/**
 * Enregistre un tracé : il doit partir de l'étape de départ et arriver à l'étape d'arrivée
 * (à moins d'1 km ; ses extrémités sont alors recollées exactement sur les étapes).
 */
export async function saveTrace(
  db: TenantDb,
  input: SaveTraceInput,
): Promise<ServiceResult<{ distanceKm: number; dureeMinutes: number }>> {
  const troncon = await getWithEnds(db, input.tronconId);
  if (!troncon) return failure("Tronçon introuvable.");
  const first = input.trace[0]!;
  const last = input.trace.at(-1)!;
  const gap = (p: TracePoint, e: { latitude: number; longitude: number }) =>
    haversineKm({ latitude: p[1], longitude: p[0] }, e);
  if (
    gap(first, troncon.etapeDepart) > MAX_ENDPOINT_GAP_KM ||
    gap(last, troncon.etapeArrivee) > MAX_ENDPOINT_GAP_KM
  ) {
    return failure(
      `Le tracé doit partir de « ${troncon.etapeDepart.nom} » et arriver à « ${troncon.etapeArrivee.nom} ».`,
    );
  }
  const trace = attachEndpoints(
    input.trace.slice(1, -1) as TracePoint[],
    [troncon.etapeDepart.longitude, troncon.etapeDepart.latitude],
    [troncon.etapeArrivee.longitude, troncon.etapeArrivee.latitude],
  );
  const distanceKm = input.remplacerDistance ? roundedLengthKm(trace) : troncon.distanceKm;
  const dureeMinutes = input.remplacerDistance
    ? estimateDurationMinutes(distanceKm, troncon.deniveleM)
    : troncon.dureeMinutes;
  await db.troncon.update({
    where: { id: troncon.id },
    data: {
      trace,
      traceSource: input.source,
      ...(input.remplacerDistance ? { distanceKm, dureeMinutes } : {}),
    },
  });
  return success({ distanceKm, dureeMinutes });
}

/** Efface le tracé : la carte relie de nouveau les étapes en ligne droite. */
export async function clearTrace(db: TenantDb, tronconId: string): Promise<ServiceResult> {
  const result = await db.troncon.updateMany({
    where: { id: tronconId },
    data: { trace: Prisma.DbNull, traceSource: null },
  });
  return result.count === 1 ? success(undefined) : failure("Tronçon introuvable.");
}

/**
 * « Proposer tous les tracés » : propose puis enregistre le tracé OSM d'un tronçon qui n'en
 * a pas encore. La distance n'est remplacée que si elle était estimée (une mesure de terrain
 * est gardée).
 */
export async function proposeAndSaveTrace(
  db: TenantDb,
  tronconId: string,
  fetcher: typeof fetch = fetch,
): Promise<ServiceResult<{ status: "deja" | "enregistre"; longueurKm?: number }>> {
  const troncon = await getWithEnds(db, tronconId);
  if (!troncon) return failure("Tronçon introuvable.");
  if (troncon.traceSource) return success({ status: "deja" });
  const proposal = await proposeTrace(db, tronconId, fetcher);
  if (!proposal.ok) return proposal;
  const saved = await saveTrace(db, {
    tronconId,
    trace: proposal.data.trace,
    source: "OSM",
    remplacerDistance: troncon.distanceEstimee,
  });
  if (!saved.ok) return saved;
  return success({ status: "enregistre", longueurKm: proposal.data.longueurKm });
}

/** Tracés enregistrés de l'agence, prêts à être enchaînés le long d'un itinéraire. */
export async function loadTraceIndex(db: TenantDb) {
  const rows = await db.troncon.findMany({
    where: { traceSource: { not: null } },
    select: { etapeDepartId: true, etapeArriveeId: true, trace: true },
  });
  const traces: StoredTrace[] = rows
    .filter((r) => Array.isArray(r.trace))
    .map((r) => ({
      from: r.etapeDepartId,
      to: r.etapeArriveeId,
      trace: r.trace as unknown as TracePoint[],
    }));
  return traceIndex(traces);
}
