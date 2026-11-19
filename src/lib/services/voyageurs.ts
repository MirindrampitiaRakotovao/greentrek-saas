import { Prisma } from "@/generated/prisma/client";
import { type Paginated, pageArgs, pageCount } from "@/lib/pagination";
import { PRESENCE_ECRITURE_MS, type Presence, presenceOf } from "@/lib/presence";
import { notifyAgencyStaff } from "@/lib/services/notifications";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import type { TenantDb } from "@/lib/tenant";

/**
 * Voyageurs entre eux (étape 5c, hors cahier des charges) : annuaire des voyageurs de
 * l'agence, blocage, signalement d'un message, confidentialité, présence « en ligne ».
 * Données minimales : prénom, initiale du nom, photo, présence ; jamais l'e-mail ni le
 * téléphone. Client confiné : tout reste dans l'agence.
 */

export type VoyageurCard = { id: string; nom: string; photo: string | null; presence: Presence };

/** Nom affiché d'un voyageur : prénom et initiale du nom (données minimales, §12). */
export function nomPublic(u: { prenom: string; nom: string }): string {
  return `${u.prenom} ${u.nom.charAt(0)}.`;
}

/** Annuaire : voyageurs actifs qui acceptent les messages, hors moi et hors blocages. */
export async function listVoyageurs(
  db: TenantDb,
  viewerId: string,
  q: string | undefined,
  page: number,
  now: Date = new Date(),
): Promise<Paginated<VoyageurCard>> {
  const search = q?.trim();
  const where: Prisma.UtilisateurWhereInput = {
    role: "CLIENT",
    actif: true,
    messagesVoyageurs: true,
    id: { not: viewerId },
    blocagesFaits: { none: { bloqueId: viewerId } },
    blocagesSubis: { none: { bloqueurId: viewerId } },
    ...(search ? { OR: [{ prenom: { contains: search } }, { nom: { contains: search } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.utilisateur.findMany({
      where,
      // Les voyageurs en ligne ou actifs récemment d'abord.
      orderBy: [{ derniereActiviteAt: { sort: "desc", nulls: "last" } }, { prenom: "asc" }],
      select: {
        id: true,
        prenom: true,
        nom: true,
        photoUrl: true,
        derniereActiviteAt: true,
        presenceVisible: true,
      },
      ...pageArgs(page),
    }),
    db.utilisateur.count({ where }),
  ]);
  return {
    items: rows.map((u) => ({
      id: u.id,
      nom: nomPublic(u),
      photo: u.photoUrl,
      presence: presenceOf(u.derniereActiviteAt, u.presenceVisible, now),
    })),
    total,
    page,
    pageCount: pageCount(total),
  };
}

/** Bloque un voyageur de l'agence (idempotent). */
export async function blockUser(
  db: TenantDb,
  input: { agenceId: string; bloqueurId: string; bloqueId: string },
): Promise<ServiceResult> {
  if (input.bloqueurId === input.bloqueId) return failure("Action impossible.");
  const cible = await db.utilisateur.findFirst({
    where: { id: input.bloqueId, role: "CLIENT" },
    select: { id: true },
  });
  if (!cible) return failure("Voyageur introuvable.");
  try {
    await db.blocage.create({ data: input });
  } catch (error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
      throw error;
    }
  }
  return success(undefined);
}

export async function unblockUser(
  db: TenantDb,
  bloqueurId: string,
  bloqueId: string,
): Promise<ServiceResult> {
  await db.blocage.deleteMany({ where: { bloqueurId, bloqueId } });
  return success(undefined);
}

/** Voyageurs que j'ai bloqués (pour les débloquer). */
export async function listBlocked(db: TenantDb, bloqueurId: string) {
  const rows = await db.blocage.findMany({
    where: { bloqueurId },
    orderBy: { createdAt: "desc" },
    select: { bloque: { select: { id: true, prenom: true, nom: true, photoUrl: true } } },
  });
  return rows.map((r) => ({ id: r.bloque.id, nom: nomPublic(r.bloque), photo: r.bloque.photoUrl }));
}

/**
 * Signalement d'un message reçu (conversation privée entre voyageurs) : l'agence est prévenue
 * et peut lire CE message (pas le reste de la conversation). Un signalement par message.
 */
export async function reportMessage(
  db: TenantDb,
  input: { agenceId: string; auteurId: string; messageId: string; motif: string | null },
  now: Date = new Date(),
): Promise<ServiceResult> {
  const message = await db.message.findFirst({
    where: {
      id: input.messageId,
      auteurId: { not: input.auteurId },
      conversation: {
        type: "VOYAGEURS",
        OR: [{ clientId: input.auteurId }, { destinataireId: input.auteurId }],
      },
    },
    select: { id: true },
  });
  if (!message) return failure("Message introuvable.");
  try {
    await db.$tenantTransaction(async (tx) => {
      await tx.signalement.create({
        data: {
          agenceId: input.agenceId,
          auteurId: input.auteurId,
          cible: "MESSAGE",
          cibleId: message.id,
          motif: input.motif,
          createdAt: now,
        },
      });
      await notifyAgencyStaff(tx, {
        type: "AVIS",
        titre: "Message signalé par un voyageur",
        message: input.motif ? input.motif.slice(0, 140) : "Sans motif précisé.",
        lienUrl: "/dashboard/signalements",
      });
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return failure("Vous avez déjà signalé ce message.");
    }
    throw error;
  }
  return success(undefined);
}

/** Signalements de l'agence (back-office), avec le contenu signalé et son auteur. */
export async function listSignalements(
  db: TenantDb,
  statut: "OUVERT" | "TRAITE" | undefined,
  page: number,
) {
  const where: Prisma.SignalementWhereInput = statut ? { statut } : {};
  const [rows, total] = await Promise.all([
    db.signalement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        cible: true,
        cibleId: true,
        motif: true,
        statut: true,
        createdAt: true,
        traiteAt: true,
        auteur: { select: { prenom: true, nom: true } },
      },
      ...pageArgs(page),
    }),
    db.signalement.count({ where }),
  ]);
  // Contenu des messages signalés (et seulement ceux-là).
  const ids = rows.filter((r) => r.cible === "MESSAGE").map((r) => r.cibleId);
  const messages = await db.message.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      contenu: true,
      createdAt: true,
      auteur: { select: { id: true, prenom: true, nom: true, actif: true } },
    },
  });
  const byId = new Map(messages.map((m) => [m.id, m]));
  return {
    items: rows.map((r) => ({
      ...r,
      signalePar: nomPublic(r.auteur),
      contenu: byId.get(r.cibleId) ?? null,
    })),
    total,
    page,
    pageCount: pageCount(total),
  };
}

export async function treatSignalement(
  db: TenantDb,
  id: string,
  now: Date = new Date(),
): Promise<ServiceResult> {
  const { count } = await db.signalement.updateMany({
    where: { id, statut: "OUVERT" },
    data: { statut: "TRAITE", traiteAt: now },
  });
  return count === 1 ? success(undefined) : failure("Signalement introuvable ou déjà traité.");
}

/** En cas d'abus, l'agence désactive le compte d'un voyageur (il ne peut plus se connecter). */
export async function deactivateClient(db: TenantDb, clientId: string): Promise<ServiceResult> {
  const { count } = await db.utilisateur.updateMany({
    where: { id: clientId, role: "CLIENT" },
    data: { actif: false },
  });
  return count === 1 ? success(undefined) : failure("Voyageur introuvable.");
}

/** Réglages de confidentialité du voyageur. */
export async function updatePrivacy(
  db: TenantDb,
  utilisateurId: string,
  input: { presenceVisible: boolean; messagesVoyageurs: boolean },
): Promise<ServiceResult> {
  await db.utilisateur.updateMany({ where: { id: utilisateurId }, data: input });
  return success(undefined);
}

/** Dernière activité (au plus une écriture par minute et par utilisateur). */
export async function touchPresence(
  db: TenantDb,
  utilisateurId: string,
  now: Date = new Date(),
): Promise<void> {
  await db.utilisateur.updateMany({
    where: {
      id: utilisateurId,
      OR: [
        { derniereActiviteAt: null },
        { derniereActiviteAt: { lt: new Date(now.getTime() - PRESENCE_ECRITURE_MS) } },
      ],
    },
    data: { derniereActiviteAt: now },
  });
}
