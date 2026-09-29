import bcrypt from "bcryptjs";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { getAdminDb } from "@/lib/admin-db";
import { type Paginated, pageArgs, pageCount } from "@/lib/pagination";
import type { TenantDb } from "@/lib/tenant";
import type { ClientRegistrationInput } from "@/lib/validators/auth";

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
): Promise<Paginated<ClientRow>> {
  const search = q?.trim();
  const where: Prisma.UtilisateurWhereInput = {
    role: "CLIENT",
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
