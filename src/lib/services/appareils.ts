import type { PrismaClient } from "@/generated/prisma/client";
import { afterCommit } from "@/lib/after-commit";
import { buildPushBatches, type PushTransport, sendExpoPush } from "@/lib/push/expo";
import type { AlertEvent } from "@/lib/realtime/events";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import { getTenantDb, type TenantDb, type TenantTx } from "@/lib/tenant";

/**
 * Téléphones des voyageurs à prévenir par notification push (application mobile, après E12).
 * Table liée à l'agence (helper tenant, comme les autres).
 */

/** Enregistre le téléphone du voyageur connecté (remplace un éventuel autre titulaire). */
export async function registerDevice(
  db: TenantDb,
  input: { agenceId: string; utilisateurId: string; expoPushToken: string; plateforme: string },
): Promise<ServiceResult> {
  await db.$tenantTransaction(async (tx) => {
    // Même téléphone, autre compte de l'agence : le dernier connecté reçoit les notifications.
    await tx.appareilMobile.deleteMany({
      where: { expoPushToken: input.expoPushToken, utilisateurId: { not: input.utilisateurId } },
    });
    const existing = await tx.appareilMobile.findFirst({
      where: { expoPushToken: input.expoPushToken },
      select: { id: true },
    });
    if (existing) {
      await tx.appareilMobile.update({
        where: { id: existing.id },
        data: { plateforme: input.plateforme },
      });
    } else {
      await tx.appareilMobile.create({ data: input });
    }
  });
  return success(undefined);
}

/** Retire le téléphone (déconnexion) : il ne reçoit plus les notifications de ce compte. */
export async function unregisterDevice(
  db: TenantDb,
  utilisateurId: string,
  expoPushToken: string,
): Promise<ServiceResult> {
  const { count } = await db.appareilMobile.deleteMany({ where: { utilisateurId, expoPushToken } });
  return count > 0 ? success(undefined) : failure("Appareil inconnu.");
}

/* Envoi : client HTTP remplaçable par les tests (aucun appel réseau pendant les tests). */
let transport: PushTransport | undefined;
let base: PrismaClient | undefined;
let pending: Promise<unknown> = Promise.resolve();

/** Tests : client HTTP factice et base de test (pour oublier les jetons refusés). */
export function setPushTransport(value: PushTransport | undefined, client?: PrismaClient): void {
  transport = value;
  base = client;
}
/** Attend la fin des envois en cours (tests). */
export function pushSettled(): Promise<unknown> {
  return pending;
}

/**
 * Prévient les téléphones des destinataires, APRÈS le commit (comme le temps réel) : pas de
 * notification pour une action annulée. Appelée par les services de notification et de
 * messagerie, dans leur transaction. Les jetons refusés par le service sont oubliés.
 */
export async function pushToDevices(
  db: TenantDb | TenantTx,
  utilisateurIds: readonly string[],
  event: AlertEvent,
): Promise<void> {
  if (utilisateurIds.length === 0) return;
  const devices = await db.appareilMobile.findMany({
    where: { utilisateurId: { in: [...new Set(utilisateurIds)] } },
    select: { agenceId: true, expoPushToken: true },
  });
  if (devices.length === 0) return;
  const agenceId = devices[0]!.agenceId;
  const batches = buildPushBatches(
    devices.map((d) => d.expoPushToken),
    event,
  );
  afterCommit(() => {
    pending = sendExpoPush(batches, transport)
      .then(async (stale) => {
        if (stale.length === 0) return;
        await getTenantDb(agenceId, base).appareilMobile.deleteMany({
          where: { expoPushToken: { in: stale } },
        });
      })
      .catch((error: unknown) => console.error("Notifications push :", error));
  });
}
