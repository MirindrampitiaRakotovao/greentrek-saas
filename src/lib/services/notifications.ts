import type { PrismaClient } from "@/generated/prisma/client";
import { publish } from "@/lib/realtime/bus";
import type { TenantDb, TenantTx } from "@/lib/tenant";

/**
 * Notifications internes (in-app, §7.6, P2, étape E12) : aucune notification n'est envoyée
 * par e-mail ou SMS (hors périmètre, §2). Créées dans la même transaction que l'événement :
 * pas de notification pour une action annulée. Elles sont aussi poussées en temps réel aux
 * destinataires connectés, après le commit (`publish`).
 */

type Db = TenantDb | TenantTx;

export type NotificationInput = {
  type: "RESERVATION" | "PAIEMENT" | "ANNULATION" | "AVIS" | "DEPART";
  titre: string;
  message: string;
  lienUrl?: string;
};

/** Agence courante du client confiné (identifiant et slug, pour les liens). */
export async function currentAgency(db: Db) {
  return db.agence.findFirstOrThrow({ select: { id: true, slug: true } });
}

/** Notifie l'équipe de l'agence (administrateurs et personnel actifs). */
export async function notifyAgencyStaff(db: Db, input: NotificationInput): Promise<void> {
  const [agence, equipe] = await Promise.all([
    currentAgency(db),
    db.utilisateur.findMany({
      where: { actif: true, role: { in: ["ADMIN_AGENCE", "STAFF"] } },
      select: { id: true },
    }),
  ]);
  if (equipe.length === 0) return;
  await db.notification.createMany({
    data: equipe.map((u) => ({ ...input, agenceId: agence.id, utilisateurId: u.id })),
  });
  publish(
    equipe.map((u) => u.id),
    {
      type: "notification",
      titre: input.titre,
      message: input.message,
      lienUrl: input.lienUrl ?? null,
    },
  );
}

/** Notifie le client d'une réservation (lien vers sa réservation dans son espace). */
export async function notifyReservationClient(
  db: Db,
  reservationId: string,
  input: Omit<NotificationInput, "lienUrl">,
): Promise<void> {
  const [agence, reservation] = await Promise.all([
    currentAgency(db),
    db.reservation.findUnique({ where: { id: reservationId }, select: { clientId: true } }),
  ]);
  if (!reservation) return;
  const lienUrl = `/a/${agence.slug}/mon-compte/reservations/${reservationId}`;
  await db.notification.create({
    data: { ...input, agenceId: agence.id, utilisateurId: reservation.clientId, lienUrl },
  });
  publish([reservation.clientId], {
    type: "notification",
    titre: input.titre,
    message: input.message,
    lienUrl,
  });
}

/** Marque comme lues les notifications de l'utilisateur (toutes, ou celles données). */
export async function markNotificationsRead(
  db: TenantDb | PrismaClient,
  utilisateurId: string,
  ids?: readonly string[],
): Promise<void> {
  await db.notification.updateMany({
    where: { utilisateurId, lue: false, ...(ids ? { id: { in: [...ids] } } : {}) },
    data: { lue: true },
  });
}
