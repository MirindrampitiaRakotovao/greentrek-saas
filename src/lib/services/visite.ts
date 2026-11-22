import type { TenantDb } from "@/lib/tenant";

/**
 * Données de la visite virtuelle « mode jeu » (étape 8b), lues par le client confiné à
 * l'agence de l'adresse.
 */

/**
 * Groupe d'une réservation, montré dans la visite (compagnons, guide) : seulement pour le
 * voyageur titulaire de la réservation, et seulement le NOMBRE de personnes et la présence
 * d'un guide (jamais de nom). Null sinon (réservation d'un autre client, annulée, inconnue).
 */
export async function visitParty(
  db: TenantDb,
  reservationId: string,
  clientId: string,
): Promise<{ personnes: number; guide: boolean } | null> {
  const r = await db.reservation.findFirst({
    where: { id: reservationId, clientId, statut: { not: "ANNULEE" } },
    select: { nombrePersonnes: true, session: { select: { guideId: true } } },
  });
  return r ? { personnes: r.nombrePersonnes, guide: r.session.guideId !== null } : null;
}

/**
 * Étapes du chemin (dans l'ordre) avec le mode du tronçon qui en part : « PIROGUE » si un
 * tronçon déclaré en pirogue relie l'étape à la suivante (dans un sens ou dans l'autre).
 */
export async function visitWaypoints(
  db: TenantDb,
  path: readonly { id: string; latitude: number; longitude: number }[],
) {
  const pirogues = await db.troncon.findMany({
    where: { mode: "PIROGUE" },
    select: { etapeDepartId: true, etapeArriveeId: true, bidirectionnel: true },
  });
  const pairs = new Set<string>();
  for (const t of pirogues) {
    pairs.add(`${t.etapeDepartId}|${t.etapeArriveeId}`);
    if (t.bidirectionnel) pairs.add(`${t.etapeArriveeId}|${t.etapeDepartId}`);
  }
  return path.map((p, i) => ({
    latitude: p.latitude,
    longitude: p.longitude,
    modeSuivant:
      i < path.length - 1 && pairs.has(`${p.id}|${path[i + 1]!.id}`)
        ? ("PIROGUE" as const)
        : ("MARCHE" as const),
  }));
}
