import type { StatutAbonnement } from "@/generated/prisma/client";

/**
 * Règles des plans et abonnements SIMULÉS (§5.2 tables 15 et 16, RG 18), en fonctions pures.
 *
 * - Un abonnement ESSAI ou ACTIF dont la date de fin est passée est EXPIRE (passage fait à
 *   l'affichage, comme les départs terminés en E7).
 * - Décision A de l'étape E11 : on compte les circuits non archivés, les comptes du personnel
 *   actifs (administrateurs, personnel, guides ; pas les clients) et les départs actifs
 *   (ouverts ou complets, pas encore terminés).
 * - Décision B : abonnement expiré ou annulé → créations bloquées ; consultation et gestion
 *   des réservations toujours possibles.
 * - Décision C : agence sans aucun abonnement (créée hors inscription, cas des tests) → pas
 *   de limite ; toute agence inscrite reçoit un abonnement ESSAI.
 */

export type LimitKind = "circuits" | "utilisateurs" | "departs";

export const LIMIT_LABELS: Record<LimitKind, { singulier: string; pluriel: string }> = {
  circuits: { singulier: "circuit", pluriel: "circuits" },
  utilisateurs: { singulier: "compte du personnel", pluriel: "comptes du personnel" },
  departs: { singulier: "départ actif", pluriel: "départs actifs" },
};

export const STATUT_ABONNEMENT_LABELS: Record<StatutAbonnement, string> = {
  ESSAI: "Essai",
  ACTIF: "Actif",
  EXPIRE: "Expiré",
  ANNULE: "Annulé",
};

/** Statut réel à la date du jour (`today` : date calendaire, minuit UTC). */
export function effectiveStatut(
  abonnement: { statut: StatutAbonnement; dateFin: Date | null },
  today: Date,
): StatutAbonnement {
  const enCours = abonnement.statut === "ESSAI" || abonnement.statut === "ACTIF";
  if (enCours && abonnement.dateFin && abonnement.dateFin < today) return "EXPIRE";
  return abonnement.statut;
}

export function isUsable(statut: StatutAbonnement): boolean {
  return statut === "ESSAI" || statut === "ACTIF";
}

export type PlanLimits = {
  maxCircuits: number;
  maxUtilisateurs: number;
  maxSessionsActives: number;
};

export function limitFor(plan: PlanLimits, kind: LimitKind): number {
  return kind === "circuits"
    ? plan.maxCircuits
    : kind === "utilisateurs"
      ? plan.maxUtilisateurs
      : plan.maxSessionsActives;
}

/**
 * Décision de création (RG 18) : `null` si autorisée, sinon le message à afficher.
 * `abonnement` null : agence sans abonnement (décision C), pas de limite.
 */
export function planRefusal(
  abonnement: { statut: StatutAbonnement; plan: { nom: string } & PlanLimits } | null,
  kind: LimitKind,
  used: number,
): string | null {
  if (!abonnement) return null;
  if (!isUsable(abonnement.statut)) {
    return `Votre abonnement est ${abonnement.statut === "EXPIRE" ? "expiré" : "annulé"} : les créations sont suspendues. Consultez les tarifs pour choisir un plan.`;
  }
  const max = limitFor(abonnement.plan, kind);
  if (used + 1 > max) {
    const label = LIMIT_LABELS[kind];
    return `Limite du plan ${abonnement.plan.nom} atteinte : ${max} ${max > 1 ? label.pluriel : label.singulier} au maximum (RG 18). Passez à un plan supérieur (page Tarifs).`;
  }
  return null;
}
