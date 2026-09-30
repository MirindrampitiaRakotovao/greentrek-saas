import { calendarDate } from "@/lib/dates";
import { effectiveStatut, type LimitKind, planRefusal } from "@/lib/plans";
import { failure, type ServiceResult } from "@/lib/services/result";
import type { TenantDb, TenantTx } from "@/lib/tenant";

/**
 * Abonnement SIMULÉ de l'agence et limites de son plan (§7.3, RG 18, étape E11).
 * Lectures par le client confiné : une agence ne voit que ses propres abonnements.
 */

type Db = TenantDb | TenantTx;

/** Abonnement courant (le plus récent), avec son statut effectif ; null s'il n'y en a pas. */
export async function getCurrentSubscription(db: Db, now: Date = new Date()) {
  const abonnement = await db.abonnement.findFirst({
    orderBy: [{ dateDebut: "desc" }, { id: "desc" }],
    select: {
      id: true,
      statut: true,
      dateDebut: true,
      dateFin: true,
      renouvellementAuto: true,
      plan: {
        select: {
          code: true,
          nom: true,
          prixMensuel: true,
          maxCircuits: true,
          maxUtilisateurs: true,
          maxSessionsActives: true,
          fonctionnalites: true,
        },
      },
    },
  });
  if (!abonnement) return null;
  const statut = effectiveStatut(abonnement, calendarDate(now));
  if (statut !== abonnement.statut) {
    // Essai ou abonnement arrivé à échéance : EXPIRE (passage fait à la lecture).
    await db.abonnement.updateMany({ where: { id: abonnement.id }, data: { statut } });
  }
  return { ...abonnement, statut };
}

export type Subscription = NonNullable<Awaited<ReturnType<typeof getCurrentSubscription>>>;

/** Utilisation actuelle, avec les règles de comptage de la décision A. */
export async function getUsage(db: Db, now: Date = new Date()): Promise<Record<LimitKind, number>> {
  const [circuits, utilisateurs, departs] = await Promise.all([
    db.circuit.count({ where: { statut: { not: "ARCHIVE" } } }),
    db.utilisateur.count({
      where: { actif: true, role: { in: ["ADMIN_AGENCE", "STAFF", "GUIDE"] } },
    }),
    db.sessionDepart.count({
      where: { statut: { in: ["OUVERTE", "COMPLETE"] }, dateFin: { gte: calendarDate(now) } },
    }),
  ]);
  return { circuits, utilisateurs, departs };
}

/**
 * Contrôle avant une création (RG 18) : `null` si elle est permise, sinon un refus à renvoyer
 * tel quel. Appelé par les services de création de circuits, de comptes et de départs.
 */
export async function checkPlanLimit(
  db: Db,
  kind: LimitKind,
  now: Date = new Date(),
): Promise<ServiceResult<never> | null> {
  const abonnement = await getCurrentSubscription(db, now);
  if (!abonnement) return null; // décision C
  const usage = await getUsage(db, now);
  const refus = planRefusal(abonnement, kind, usage[kind]);
  return refus ? failure(refus) : null;
}
