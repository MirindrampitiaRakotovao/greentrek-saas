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
  | "Conversation";

type Scope =
  /** Table portant `agenceId`. */
  | { kind: "tenant" }
  /** Table de liaison : l'agence est celle du parent (`relation`). */
  | { kind: "child"; relation: string }
  /** La table `Agence` elle-même : une agence ne voit qu'elle-même. */
  | { kind: "root" }
  /** Table globale en lecture seule (plans). */
  | { kind: "global" };

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
    references: { clientId: "Utilisateur", reservationId: "Reservation" },
  },
  Message: {
    scope: { kind: "child", relation: "conversation" },
    references: { conversationId: "Conversation", auteurId: "Utilisateur" },
  },
  LectureConversation: {
    scope: { kind: "child", relation: "conversation" },
    references: { conversationId: "Conversation", utilisateurId: "Utilisateur" },
  },
};
