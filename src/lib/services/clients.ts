import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { getAdminDb } from "@/lib/admin-db";
import { calendarDate } from "@/lib/dates";
import { firstBookableDate, placesReservees } from "@/lib/departs";
import { type Paginated, pageArgs, pageCount } from "@/lib/pagination";
import { newInvitationToken } from "@/lib/services/mot-de-passe";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import type { TenantDb } from "@/lib/tenant";
import type { ClientRegistrationInput } from "@/lib/validators/auth";
import type { CreateClientInput, Origine, UpdateClientInput } from "@/lib/validators/clients";

const BCRYPT_COST = 10;

export type ClientRegistrationResult =
  { ok: true; clientId: string } | { ok: false; field: "email" | "form"; message: string };

const EMAIL_TAKEN = "Un compte existe déjà avec cette adresse : connectez-vous.";

/**
 * Inscription d'un voyageur sur le site d'une agence (§7.2) : compte de rôle CLIENT, rattaché
 * à l'agence du slug (RG 2), e-mail unique au sein de l'agence (RG 3). Comme la connexion,
 * c'est une opération d'avant session (l'agence vient de l'URL) : client non confiné, mais
 * il ne crée que des comptes CLIENT, et seulement pour une agence ACTIVE (RG 19).
 */
export async function registerClient(
  input: ClientRegistrationInput,
  client: PrismaClient = getAdminDb(),
): Promise<ClientRegistrationResult> {
  const agence = await client.agence.findFirst({
    where: { slug: input.agenceSlug, statut: "ACTIVE" },
    select: { id: true },
  });
  if (!agence) return { ok: false, field: "form", message: "Agence introuvable." };

  const existing = await client.utilisateur.findFirst({
    where: { agenceId: agence.id, email: input.email },
    select: { id: true },
  });
  if (existing) return { ok: false, field: "email", message: EMAIL_TAKEN };

  try {
    const created = await client.utilisateur.create({
      data: {
        agenceId: agence.id,
        prenom: input.prenom,
        nom: input.nom,
        email: input.email,
        telephone: input.telephone,
        motDePasseHash: await bcrypt.hash(input.password, BCRYPT_COST),
        role: "CLIENT",
      },
      select: { id: true },
    });
    return { ok: true, clientId: created.id };
  } catch (error: unknown) {
    // Deux inscriptions simultanées avec la même adresse : l'index unique tranche.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, field: "email", message: EMAIL_TAKEN };
    }
    throw error;
  }
}

/* ─── Clients vus par l'agence (§7.3, lecture seule : décision E de l'étape E10) ─── */

export type ClientRow = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  origine: Origine;
  actif: boolean;
  createdAt: Date;
  reservations: number;
  /** Montant des réservations non annulées. */
  totalReserve: number;
  derniereReservation: Date | null;
};

export async function listClients(
  db: TenantDb,
  q: string | undefined,
  page: number,
  origine?: Origine,
): Promise<Paginated<ClientRow>> {
  const search = q?.trim();
  const where: Prisma.UtilisateurWhereInput = {
    role: "CLIENT",
    ...(origine ? { origine } : {}),
    ...(search
      ? {
          OR: [
            { nom: { contains: search } },
            { prenom: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}),
  };
  const [clients, total] = await Promise.all([
    db.utilisateur.findMany({
      where,
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
      select: {
        id: true,
        prenom: true,
        nom: true,
        email: true,
        telephone: true,
        origine: true,
        actif: true,
        createdAt: true,
      },
      ...pageArgs(page),
    }),
    db.utilisateur.count({ where }),
  ]);
  // Totaux calculés par la base (un groupBy pour la page), pas en mémoire.
  const ids = clients.map((c) => c.id);
  const [actives, toutes] = await Promise.all([
    db.reservation.groupBy({
      by: ["clientId"],
      where: { clientId: { in: ids }, statut: { not: "ANNULEE" } },
      _sum: { montantTotal: true },
    }),
    db.reservation.groupBy({
      by: ["clientId"],
      where: { clientId: { in: ids } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
  ]);
  const items = clients.map((c) => {
    const a = actives.find((g) => g.clientId === c.id);
    const t = toutes.find((g) => g.clientId === c.id);
    return {
      ...c,
      reservations: t?._count._all ?? 0,
      totalReserve: a?._sum.montantTotal ?? 0,
      derniereReservation: t?._max.createdAt ?? null,
    };
  });
  return { items, total, page, pageCount: pageCount(total) };
}

/** Fiche d'un client de l'agence avec l'historique de ses réservations. */
export function getClientDetail(db: TenantDb, id: string) {
  return db.utilisateur.findFirst({
    where: { id, role: "CLIENT" },
    select: {
      id: true,
      prenom: true,
      nom: true,
      email: true,
      telephone: true,
      origine: true,
      actif: true,
      createdAt: true,
      dernierLoginAt: true,
      reservations: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          reference: true,
          statut: true,
          nombrePersonnes: true,
          montantTotal: true,
          createdAt: true,
          session: {
            select: { dateDebut: true, dateFin: true, circuit: { select: { titre: true } } },
          },
        },
      },
    },
  });
}

export const CLIENT_EMAIL_TAKEN = "Un compte utilise déjà cette adresse dans votre agence.";

/**
 * Client ajouté par l'agence (après E12) : compte voyageur de l'agence (RG 2), e-mail unique
 * dans l'agence (RG 3), sans mot de passe utilisable ; le client reçoit un lien d'invitation
 * (7 jours, usage unique) pour choisir le sien. Renvoie le jeton à envoyer par e-mail (jamais
 * conservé en clair).
 */
export async function createClientByAgency(
  db: TenantDb,
  agenceId: string,
  input: CreateClientInput,
  now: Date = new Date(),
): Promise<ServiceResult<{ id: string; jeton: string }>> {
  const existing = await db.utilisateur.findFirst({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) return failure(CLIENT_EMAIL_TAKEN, "email");
  // Mot de passe aléatoire jamais communiqué : le compte n'est utilisable qu'après l'invitation.
  const motDePasseHash = await bcrypt.hash(randomBytes(32).toString("base64url"), BCRYPT_COST);
  try {
    return await db.$tenantTransaction(async (tx) => {
      const client = await tx.utilisateur.create({
        data: {
          agenceId,
          prenom: input.prenom,
          nom: input.nom,
          email: input.email,
          telephone: input.telephone,
          role: "CLIENT",
          origine: "AGENCE",
          motDePasseHash,
          createdAt: now,
        },
        select: { id: true },
      });
      const invitation = newInvitationToken(now);
      await tx.jetonReinitialisation.create({
        data: { utilisateurId: client.id, ...invitation.data },
      });
      return success({ id: client.id, jeton: invitation.jeton });
    });
  } catch (error: unknown) {
    // Deux ajouts simultanés de la même adresse : l'index unique (agence, e-mail) tranche.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return failure(CLIENT_EMAIL_TAKEN, "email");
    }
    throw error;
  }
}

/**
 * Modification d'un client par l'agence (décision E bis) : prénom, nom, e-mail, téléphone et
 * état du compte. L'e-mail reste unique dans l'agence (RG 3) ; c'est l'identifiant de
 * connexion du voyageur, qui se connecte ensuite avec la nouvelle adresse.
 */
export async function updateClient(db: TenantDb, input: UpdateClientInput): Promise<ServiceResult> {
  const client = await db.utilisateur.findFirst({
    where: { id: input.id, role: "CLIENT" },
    select: { id: true },
  });
  if (!client) return failure("Client introuvable.");
  const taken = await db.utilisateur.findFirst({
    where: { email: input.email, id: { not: client.id } },
    select: { id: true },
  });
  if (taken) return failure(CLIENT_EMAIL_TAKEN, "email");
  try {
    await db.utilisateur.update({
      where: { id: client.id },
      data: {
        prenom: input.prenom,
        nom: input.nom,
        email: input.email,
        telephone: input.telephone,
        actif: input.actif,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return failure(CLIENT_EMAIL_TAKEN, "email");
    }
    throw error;
  }
  return success(undefined);
}

export const CLIENT_HAS_RESERVATIONS =
  "Ce client a des réservations : il ne peut pas être supprimé, pour garder la trace des réservations, paiements et factures. Désactivez plutôt son compte (bouton « Modifier »).";

/**
 * Suppression d'un client (décision E bis), seulement s'il n'a AUCUNE réservation (même
 * annulée) : réservations, paiements et factures sont des traces à conserver (décision D).
 * Sinon, refus et proposition de désactiver le compte. Dans une même transaction, on retire
 * ce qui n'appartient qu'à lui : itinéraires sur mesure, conversations (avec leurs messages)
 * et signalements ; le reste suit par cascade (notifications, appareils, jetons, communauté),
 * le journal d'activité garde l'action sans l'auteur. Renvoie la photo de profil à effacer.
 */
export async function deleteClient(
  db: TenantDb,
  id: string,
): Promise<ServiceResult<{ photoUrl: string | null }>> {
  try {
    return await db.$tenantTransaction(async (tx) => {
      const client = await tx.utilisateur.findFirst({
        where: { id, role: "CLIENT" },
        select: { id: true, photoUrl: true },
      });
      if (!client) return failure("Client introuvable.");
      if ((await tx.reservation.count({ where: { clientId: client.id } })) > 0) {
        return failure(CLIENT_HAS_RESERVATIONS);
      }
      await tx.itinerairePersonnalise.deleteMany({
        where: { OR: [{ clientId: client.id }, { creeParId: client.id }] },
      });
      // Messages et accusés de lecture suivent la conversation (cascade).
      await tx.conversation.deleteMany({
        where: { OR: [{ clientId: client.id }, { destinataireId: client.id }] },
      });
      await tx.utilisateur.delete({ where: { id: client.id } });
      return success({ photoUrl: client.photoUrl });
    });
  } catch (error: unknown) {
    // Réservation créée au même instant : la clé étrangère (Restrict) refuse la suppression.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return failure(CLIENT_HAS_RESERVATIONS);
    }
    throw error;
  }
}

/**
 * Départs que l'agence peut réserver pour un client : mêmes conditions que le site (ouverts,
 * circuit publié, à partir du lendemain) et au moins une place libre.
 */
export async function listBookableDeparts(db: TenantDb, now: Date = new Date()) {
  const sessions = await db.sessionDepart.findMany({
    where: {
      statut: "OUVERTE",
      dateDebut: { gte: firstBookableDate(calendarDate(now)) },
      circuit: { statut: "PUBLIE" },
    },
    orderBy: { dateDebut: "asc" },
    select: {
      id: true,
      dateDebut: true,
      dateFin: true,
      placesTotal: true,
      prixParPersonne: true,
      circuit: { select: { titre: true, prixParPersonne: true } },
      reservations: {
        where: { statut: { not: "ANNULEE" } },
        select: { nombrePersonnes: true, statut: true },
      },
    },
  });
  return sessions
    .map((s) => ({
      id: s.id,
      circuit: s.circuit.titre,
      dateDebut: s.dateDebut,
      dateFin: s.dateFin,
      placesLibres: s.placesTotal - placesReservees(s.reservations),
      prix: s.prixParPersonne ?? s.circuit.prixParPersonne,
    }))
    .filter((s) => s.placesLibres > 0);
}
