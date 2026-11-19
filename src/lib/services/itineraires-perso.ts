import type { Prisma, StatutItineraire } from "@/generated/prisma/client";
import { CRITERIA_LABELS } from "@/lib/graph/weights";
import { type Paginated, pageArgs, pageCount } from "@/lib/pagination";
import { notifyAgencyStaff, notifyClientUser } from "@/lib/services/notifications";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import type { TenantDb } from "@/lib/tenant";

/**
 * Itinéraires sur mesure (après E12, demande de l'étudiant) : entre des villages du réseau
 * de l'agence, pour UN client.
 * - origine AGENCE : l'agence compose l'itinéraire (calculateur du back-office) et le propose
 *   au client, qui l'accepte ou le décline ;
 * - origine CLIENT : le voyageur compose le sien et l'envoie à l'agence (étape 4b).
 * Le tracé vient du calcul enregistré dans l'historique (`ItineraireCalcule`) : rien n'est
 * recalculé ni recopié. Client confiné : tout reste dans l'agence.
 */

export const STATUT_ITINERAIRE_LABELS: Record<StatutItineraire, string> = {
  EN_ATTENTE: "En attente de réponse",
  ACCEPTE: "Accepté",
  DECLINE: "Décliné",
};

export type ItineraireStep = { id: string; nom: string; latitude: number; longitude: number };

const select = {
  id: true,
  origine: true,
  titre: true,
  message: true,
  statut: true,
  reponse: true,
  reponduAt: true,
  createdAt: true,
  clientId: true,
  client: { select: { prenom: true, nom: true } },
  creePar: { select: { prenom: true, nom: true, role: true } },
  itineraire: {
    select: {
      critere: true,
      cheminJson: true,
      distanceTotaleKm: true,
      dureeTotaleMin: true,
      difficulteCumulee: true,
    },
  },
} satisfies Prisma.ItinerairePersonnaliseSelect;

type Row = Prisma.ItinerairePersonnaliseGetPayload<{ select: typeof select }>;

/** Étapes du chemin, lues dans l'instantané du calcul (`cheminJson.etapes`). */
export function stepsOf(cheminJson: unknown): ItineraireStep[] {
  const etapes = (cheminJson as { etapes?: unknown } | null)?.etapes;
  if (!Array.isArray(etapes)) return [];
  return etapes.flatMap((e) => {
    const s = e as Partial<ItineraireStep>;
    return typeof s.id === "string" &&
      typeof s.nom === "string" &&
      typeof s.latitude === "number" &&
      typeof s.longitude === "number"
      ? [{ id: s.id, nom: s.nom, latitude: s.latitude, longitude: s.longitude }]
      : [];
  });
}

function toItineraire(r: Row) {
  const etapes = stepsOf(r.itineraire.cheminJson);
  return {
    id: r.id,
    origine: r.origine,
    titre: r.titre,
    message: r.message,
    statut: r.statut,
    statutLabel: STATUT_ITINERAIRE_LABELS[r.statut],
    reponse: r.reponse,
    reponduAt: r.reponduAt,
    createdAt: r.createdAt,
    clientId: r.clientId,
    client: `${r.client.prenom} ${r.client.nom}`,
    auteur: `${r.creePar.prenom} ${r.creePar.nom}`,
    critere: CRITERIA_LABELS[r.itineraire.critere],
    distanceKm: r.itineraire.distanceTotaleKm,
    dureeMinutes: r.itineraire.dureeTotaleMin,
    // Difficulté moyenne pondérée par la distance (1 à 5), comme le calculateur
    // (`src/lib/graph/search.ts` : difficulté cumulée = Σ difficulté × km).
    difficulteMoyenne:
      r.itineraire.distanceTotaleKm > 0
        ? r.itineraire.difficulteCumulee / r.itineraire.distanceTotaleKm
        : null,
    depart: etapes[0]?.nom ?? null,
    arrivee: etapes.at(-1)?.nom ?? null,
    etapes,
  };
}

export type Itineraire = ReturnType<typeof toItineraire>;

/** Proposition de l'agence à un de ses clients, à partir d'un calcul de l'historique. */
export async function proposeItineraire(
  db: TenantDb,
  input: {
    agenceId: string;
    agenceSlug: string;
    auteurId: string;
    clientId: string;
    historiqueId: string;
    titre: string;
    message: string | null;
  },
  now: Date = new Date(),
): Promise<ServiceResult<{ id: string }>> {
  // Garde : un identifiant vide ne doit jamais désigner « le premier calcul venu ».
  if (!input.historiqueId) return failure("Calculez d'abord l'itinéraire.");
  const [client, calcul] = await Promise.all([
    db.utilisateur.findFirst({
      where: { id: input.clientId, role: "CLIENT", actif: true },
      select: { id: true },
    }),
    db.itineraireCalcule.findFirst({ where: { id: input.historiqueId }, select: { id: true } }),
  ]);
  if (!client) return failure("Client introuvable.");
  if (!calcul) return failure("Calculez d'abord l'itinéraire.");
  return db.$tenantTransaction(async (tx) => {
    const created = await tx.itinerairePersonnalise.create({
      data: {
        agenceId: input.agenceId,
        clientId: input.clientId,
        creeParId: input.auteurId,
        itineraireCalculeId: input.historiqueId,
        origine: "AGENCE",
        titre: input.titre,
        message: input.message,
        createdAt: now,
      },
      select: { id: true },
    });
    await notifyClientUser(tx, input.clientId, {
      type: "ITINERAIRE",
      titre: "Votre agence vous propose un itinéraire",
      message: input.titre,
      lienUrl: `/a/${input.agenceSlug}/mon-compte/itineraires/${created.id}`,
    });
    return success(created);
  });
}

/** Itinéraires d'un client (les siens uniquement), les plus récents d'abord. */
export async function listItinerairesClient(db: TenantDb, clientId: string) {
  const rows = await db.itinerairePersonnalise.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    select,
  });
  return rows.map(toItineraire);
}

/** Un itinéraire du client (null s'il n'est pas à lui : 404). */
export async function getItineraireClient(db: TenantDb, id: string, clientId: string) {
  const row = await db.itinerairePersonnalise.findFirst({ where: { id, clientId }, select });
  return row ? toItineraire(row) : null;
}

/** Itinéraires de l'agence (back-office), filtrables par client, origine et statut. */
export async function listItinerairesAgence(
  db: TenantDb,
  filters: { clientId?: string; origine?: "AGENCE" | "CLIENT"; statut?: StatutItineraire },
  page = 1,
): Promise<Paginated<Itineraire>> {
  const where: Prisma.ItinerairePersonnaliseWhereInput = {
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    ...(filters.origine ? { origine: filters.origine } : {}),
    ...(filters.statut ? { statut: filters.statut } : {}),
  };
  const [rows, total] = await Promise.all([
    db.itinerairePersonnalise.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select,
      ...pageArgs(page),
    }),
    db.itinerairePersonnalise.count({ where }),
  ]);
  return { items: rows.map(toItineraire), total, page, pageCount: pageCount(total) };
}

/** Réponse du client à une proposition de l'agence : accepter ou décliner (une fois). */
export async function answerItineraire(
  db: TenantDb,
  input: { id: string; clientId: string; decision: "ACCEPTE" | "DECLINE"; reponse: string | null },
  now: Date = new Date(),
): Promise<ServiceResult> {
  const row = await db.itinerairePersonnalise.findFirst({
    where: { id: input.id, clientId: input.clientId },
    select: {
      origine: true,
      statut: true,
      titre: true,
      client: { select: { prenom: true, nom: true } },
    },
  });
  if (!row) return failure("Itinéraire introuvable.");
  if (row.origine !== "AGENCE") return failure("Cet itinéraire attend la réponse de l'agence.");
  if (row.statut !== "EN_ATTENTE") return failure("Vous avez déjà répondu à cette proposition.");
  return db.$tenantTransaction(async (tx) => {
    // Réponse unique, même en cas de double envoi : seule la ligne encore en attente change.
    const { count } = await tx.itinerairePersonnalise.updateMany({
      where: { id: input.id, statut: "EN_ATTENTE" },
      data: { statut: input.decision, reponse: input.reponse, reponduAt: now },
    });
    if (count !== 1) return failure("Vous avez déjà répondu à cette proposition.");
    await notifyAgencyStaff(tx, {
      type: "ITINERAIRE",
      titre: `Itinéraire ${input.decision === "ACCEPTE" ? "accepté" : "décliné"} par ${row.client.prenom} ${row.client.nom}`,
      message: row.titre,
      lienUrl: `/dashboard/clients/${input.clientId}`,
    });
    return success(undefined);
  });
}
