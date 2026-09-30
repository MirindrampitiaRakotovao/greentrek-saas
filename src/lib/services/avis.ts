import { Prisma, type StatutAvis } from "@/generated/prisma/client";
import { type Paginated, pageArgs, pageCount } from "@/lib/pagination";
import { notifyAgencyStaff } from "@/lib/services/notifications";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import type { TenantDb } from "@/lib/tenant";

/**
 * Avis des voyageurs (§5.2 table 17, P2, étape E12).
 * - RG 17 : un avis n'est possible que pour une réservation TERMINEE, et un seul par
 *   réservation (index unique en base) ; seul le client titulaire peut le donner.
 * - Modération : un avis est EN_ATTENTE jusqu'à sa publication (ou son rejet) par l'agence ;
 *   seuls les avis PUBLIE apparaissent sur le site vitrine, avec le prénom et l'initiale du
 *   nom (données personnelles minimales, §12).
 */

export async function createAvis(
  db: TenantDb,
  input: {
    agenceId: string;
    reservationId: string;
    clientId: string;
    note: number;
    commentaire: string | null;
  },
  now: Date = new Date(),
): Promise<ServiceResult> {
  const reservation = await db.reservation.findFirst({
    where: { id: input.reservationId, clientId: input.clientId },
    select: {
      statut: true,
      session: { select: { dateFin: true, circuitId: true } },
      avis: { select: { id: true } },
    },
  });
  if (!reservation) return failure("Réservation introuvable.");
  if (reservation.statut !== "TERMINEE") {
    return failure("Vous pourrez donner votre avis une fois le séjour terminé (RG 17).");
  }
  if (reservation.avis) return failure("Vous avez déjà donné votre avis sur ce séjour.");
  try {
    await db.avis.create({
      data: {
        agenceId: input.agenceId,
        circuitId: reservation.session.circuitId,
        reservationId: input.reservationId,
        clientId: input.clientId,
        note: input.note,
        commentaire: input.commentaire,
        statut: "EN_ATTENTE",
        createdAt: now,
      },
    });
    await notifyAgencyStaff(db, {
      type: "AVIS",
      titre: `Nouvel avis (${input.note}/5) à modérer`,
      message: input.commentaire ? input.commentaire.slice(0, 140) : "Avis sans commentaire.",
      lienUrl: "/dashboard/avis",
    });
    return success(undefined);
  } catch (error: unknown) {
    // Deux envois simultanés : l'index unique (un avis par réservation) tranche.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return failure("Vous avez déjà donné votre avis sur ce séjour.");
    }
    throw error;
  }
}

const avisSelect = {
  id: true,
  note: true,
  commentaire: true,
  statut: true,
  createdAt: true,
  circuit: { select: { id: true, titre: true } },
  client: { select: { prenom: true, nom: true } },
  reservation: { select: { id: true, reference: true } },
} satisfies Prisma.AvisSelect;

export type AvisRow = Prisma.AvisGetPayload<{ select: typeof avisSelect }>;

export async function listAvis(
  db: TenantDb,
  statut: StatutAvis | undefined,
  page: number,
): Promise<Paginated<AvisRow>> {
  const where: Prisma.AvisWhereInput = statut ? { statut } : {};
  const [items, total] = await Promise.all([
    db.avis.findMany({
      where,
      select: avisSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...pageArgs(page),
    }),
    db.avis.count({ where }),
  ]);
  return { items, total, page, pageCount: pageCount(total) };
}

/** Modération : publication ou rejet d'un avis (et retour possible sur la décision). */
export async function moderateAvis(
  db: TenantDb,
  id: string,
  statut: "PUBLIE" | "REJETE",
): Promise<ServiceResult> {
  const result = await db.avis.updateMany({ where: { id }, data: { statut } });
  return result.count === 1 ? success(undefined) : failure("Avis introuvable.");
}

export type Note = { moyenne: number; nombre: number };

/** Note moyenne (avis publiés) de chaque circuit demandé. */
export async function circuitRatings(
  db: TenantDb,
  circuitIds: readonly string[],
): Promise<Map<string, Note>> {
  if (circuitIds.length === 0) return new Map();
  const groups = await db.avis.groupBy({
    by: ["circuitId"],
    where: { statut: "PUBLIE", circuitId: { in: [...circuitIds] } },
    _avg: { note: true },
    _count: { _all: true },
  });
  return new Map(
    groups.map((g) => [
      g.circuitId,
      { moyenne: Math.round((g._avg.note ?? 0) * 10) / 10, nombre: g._count._all },
    ]),
  );
}

/** Avis publiés, pour le site vitrine : prénom et initiale du nom seulement (§12). */
export async function listPublicAvis(
  db: TenantDb,
  options: { circuitId?: string; take?: number; minNote?: number } = {},
) {
  const avis = await db.avis.findMany({
    where: {
      statut: "PUBLIE",
      ...(options.circuitId ? { circuitId: options.circuitId } : {}),
      ...(options.minNote ? { note: { gte: options.minNote } } : {}),
      commentaire: { not: null },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: options.take ?? 6,
    select: {
      id: true,
      note: true,
      commentaire: true,
      createdAt: true,
      circuit: { select: { titre: true, slug: true } },
      client: { select: { prenom: true, nom: true } },
    },
  });
  return avis.map(({ client, ...a }) => ({
    ...a,
    auteur: `${client.prenom} ${client.nom.charAt(0)}.`,
  }));
}

export type PublicAvis = Awaited<ReturnType<typeof listPublicAvis>>[number];
