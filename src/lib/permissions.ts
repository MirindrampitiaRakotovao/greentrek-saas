import type { Role } from "@/generated/prisma/client";

/**
 * Contrôle d'accès par rôle (RBAC), traduction de la matrice du cahier des charges §3.
 *
 * Cette matrice répond à « ce rôle peut-il faire cette action sur ce type de ressource ? ».
 * La portée (« la sienne », « les siens », « publiés ») est vérifiée ailleurs :
 * - l'agence : par le helper tenant (`src/lib/tenant.ts`) ;
 * - le propriétaire (client, guide) : par la requête elle-même (filtre sur `clientId`, `guideId`).
 *
 * Messagerie (ajoutée après E12, hors §3) : l'équipe de l'agence, le guide (conversations de
 * ses départs) et le client (les siennes) écrivent et lisent. Le super admin n'y a pas accès :
 * ce sont des échanges privés entre une agence et ses voyageurs.
 */

export const ACTIONS = ["creer", "lire", "modifier", "supprimer", "annuler", "moderer"] as const;
export type Action = (typeof ACTIONS)[number];

export const RESOURCES = [
  "agence",
  "plan",
  "abonnement",
  "utilisateur",
  "guide",
  "partenaire",
  "circuit",
  "etape",
  "troncon",
  "sessionDepart",
  "reservation",
  "paiement",
  "avis",
  "message",
] as const;
export type Resource = (typeof RESOURCES)[number];

type Matrix = Readonly<Record<Role, Readonly<Partial<Record<Resource, readonly Action[]>>>>>;

const CLMS: readonly Action[] = ["creer", "lire", "modifier", "supprimer"];
const CLM: readonly Action[] = ["creer", "lire", "modifier"];
const L: readonly Action[] = ["lire"];

export const PERMISSIONS: Matrix = {
  SUPER_ADMIN: {
    agence: CLMS,
    plan: CLMS,
    abonnement: CLMS,
    utilisateur: L,
    guide: L,
    partenaire: L,
    circuit: L,
    etape: L,
    troncon: L,
    sessionDepart: L,
    reservation: L,
    paiement: L,
    avis: L,
  },
  ADMIN_AGENCE: {
    agence: ["lire", "modifier"], // la sienne, paramètres
    plan: L,
    abonnement: L,
    utilisateur: CLMS,
    guide: CLMS,
    partenaire: CLMS,
    circuit: CLMS,
    etape: CLMS,
    troncon: CLMS,
    sessionDepart: CLMS,
    reservation: [...CLMS, "annuler"],
    paiement: CLMS,
    avis: ["lire", "moderer"],
    message: ["creer", "lire"],
  },
  STAFF: {
    utilisateur: L,
    guide: L,
    partenaire: L,
    circuit: CLM,
    etape: CLM,
    troncon: CLM,
    sessionDepart: CLM,
    reservation: [...CLM, "annuler"],
    paiement: CLM,
    avis: ["lire", "moderer"],
    message: ["creer", "lire"],
  },
  GUIDE: {
    circuit: L,
    etape: L,
    troncon: L,
    sessionDepart: L, // les siens
    reservation: L, // de ses départs
    message: ["creer", "lire"], // conversations de ses départs
  },
  CLIENT: {
    circuit: L, // publiés
    etape: L,
    troncon: L,
    sessionDepart: L, // ouverts
    reservation: ["creer", "lire", "annuler"], // les siennes
    paiement: L, // les siens
    avis: ["creer", "lire"],
    message: ["creer", "lire"], // les siennes
  },
};

export function can(role: Role, action: Action, resource: Resource): boolean {
  return PERMISSIONS[role][resource]?.includes(action) ?? false;
}

export class ForbiddenError extends Error {
  constructor(role: Role, action: Action, resource: Resource) {
    super(`Accès refusé : le rôle ${role} ne peut pas « ${action} » la ressource « ${resource} ».`);
    this.name = "ForbiddenError";
  }
}

/** Lève `ForbiddenError` si le rôle n'a pas le droit demandé. */
export function assertCan(role: Role, action: Action, resource: Resource): void {
  if (!can(role, action, resource)) {
    throw new ForbiddenError(role, action, resource);
  }
}
