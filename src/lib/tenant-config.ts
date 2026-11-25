import type { Prisma } from "@/generated/prisma/client";

/**
 * Configuration du helper tenant (`src/lib/tenant.ts`) : portée de chaque table et clés
 * étrangères à contrôler. Données pures, sans accès à la base.
 */

export type ModelName = Prisma.ModelName;

/** Tables pouvant être la cible d'une clé étrangère contrôlée. */
export type ReferenceTarget =
  | "Utilisateur"
  | "Etape"
  | "Circuit"
  | "Guide"
  | "SessionDepart"
  | "Reservation"
  | "Partenaire"
  | "Conversation"
  | "ItineraireCalcule"
  | "ItinerairePersonnalise";

type Scope =
  /** Table portant `agenceId`. */
  | { kind: "tenant" }
  /** Table de liaison : l'agence est celle du parent (`relation`). */
  | { kind: "child"; relation: string }
  /** La table `Agence` elle-même : une agence ne voit qu'elle-même. */
  | { kind: "root" }
  /** Table globale en lecture seule (plans). */
  | { kind: "global" }
  /**
   * Table de la plateforme (communauté, étape 5d) : partagée par toutes les agences et
   * modérée par le super admin, donc INTERDITE au client confiné d'une agence. Accès par le
   * service de la communauté seulement (client non confiné, voyageur vérifié).
   */
  | { kind: "platform" };

export type ModelConfig = {
  scope: Scope;
  /** Clés étrangères à contrôler : champ → table cible (qui doit être de la même agence). */
  references: Readonly<Record<string, ReferenceTarget>>;
  /** Champs JSON : leur contenu libre n'est pas analysé comme une écriture imbriquée. */
  jsonFields?: readonly string[];
};

/**
 * Configuration explicite de chaque table. Le test `tests/unit/tenant-config.test.ts`
 * vérifie qu'elle couvre bien toutes les tables et toutes les clés étrangères du schéma.
 */
export const TENANT_CONFIG: Readonly<Record<ModelName, ModelConfig>> = {
  Agence: { scope: { kind: "root" }, references: {} },
  Plan: { scope: { kind: "global" }, references: {}, jsonFields: ["fonctionnalites"] },
  Utilisateur: { scope: { kind: "tenant" }, references: {} },
  Guide: {
    scope: { kind: "tenant" },
    references: { utilisateurId: "Utilisateur" },
    jsonFields: ["langues"],
  },
  Circuit: { scope: { kind: "tenant" }, references: {} },
  Etape: { scope: { kind: "tenant" }, references: {} },
  Troncon: {
    scope: { kind: "tenant" },
    references: { etapeDepartId: "Etape", etapeArriveeId: "Etape" },
    jsonFields: ["trace"],
  },
  Partenaire: { scope: { kind: "tenant" }, references: {} },
  SessionDepart: {
    scope: { kind: "tenant" },
    references: { circuitId: "Circuit", guideId: "Guide" },
  },
  Reservation: {
    scope: { kind: "tenant" },
    references: { clientId: "Utilisateur", sessionId: "SessionDepart" },
  },
  Avis: {
    scope: { kind: "tenant" },
    references: { circuitId: "Circuit", reservationId: "Reservation", clientId: "Utilisateur" },
  },
  Notification: { scope: { kind: "tenant" }, references: { utilisateurId: "Utilisateur" } },
  JournalActivite: {
    scope: { kind: "tenant" },
    references: { utilisateurId: "Utilisateur" },
    jsonFields: ["details"],
  },
  ItineraireCalcule: {
    scope: { kind: "tenant" },
    references: {
      circuitId: "Circuit",
      etapeDepartId: "Etape",
      etapeArriveeId: "Etape",
      creeParId: "Utilisateur",
    },
    jsonFields: ["cheminJson"],
  },
  Abonnement: { scope: { kind: "tenant" }, references: {} }, // planId vise une table globale
  // Communauté (étape 5d) : aucune opération par le client d'une agence, rien à contrôler.
  Publication: { scope: { kind: "platform" }, references: {}, jsonFields: ["photos"] },
  Commentaire: { scope: { kind: "platform" }, references: {} },
  Jaime: { scope: { kind: "platform" }, references: {} },
  SignalementCommunaute: { scope: { kind: "platform" }, references: {} },
  CircuitEtape: {
    scope: { kind: "child", relation: "circuit" },
    references: { circuitId: "Circuit", etapeId: "Etape" },
  },
  CircuitPartenaire: {
    scope: { kind: "child", relation: "circuit" },
    references: { circuitId: "Circuit", partenaireId: "Partenaire", etapeId: "Etape" },
  },
  Participant: {
    scope: { kind: "child", relation: "reservation" },
    references: { reservationId: "Reservation" },
  },
  Paiement: {
    scope: { kind: "child", relation: "reservation" },
    references: { reservationId: "Reservation" },
  },
  Conversation: {
    scope: { kind: "tenant" },
    references: {
      clientId: "Utilisateur",
      destinataireId: "Utilisateur",
      reservationId: "Reservation",
    },
  },
  Blocage: {
    scope: { kind: "tenant" },
    references: { bloqueurId: "Utilisateur", bloqueId: "Utilisateur" },
  },
  Signalement: { scope: { kind: "tenant" }, references: { auteurId: "Utilisateur" } },
  Message: {
    scope: { kind: "child", relation: "conversation" },
    references: { conversationId: "Conversation", auteurId: "Utilisateur" },
  },
  // Jamais lue par un client confiné (parcours « mot de passe oublié », sans session) :
  // déclarée pour la complétude, rattachée à l'agence de l'utilisateur.
  JetonReinitialisation: {
    scope: { kind: "child", relation: "utilisateur" },
    references: { utilisateurId: "Utilisateur" },
  },
  AppareilMobile: { scope: { kind: "tenant" }, references: { utilisateurId: "Utilisateur" } },
  ItinerairePersonnalise: {
    scope: { kind: "tenant" },
    references: {
      clientId: "Utilisateur",
      creeParId: "Utilisateur",
      itineraireCalculeId: "ItineraireCalcule",
    },
  },
  // Étape 9 : départ d'un itinéraire sur mesure (guide de la même agence).
  DepartSurMesure: {
    scope: { kind: "tenant" },
    references: { itineraireId: "ItinerairePersonnalise", guideId: "Guide" },
  },
  LectureConversation: {
    scope: { kind: "child", relation: "conversation" },
    references: { conversationId: "Conversation", utilisateurId: "Utilisateur" },
  },
};
