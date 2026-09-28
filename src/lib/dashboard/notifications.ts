import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantDb } from "@/lib/tenant";

/** Notifications in-app de l'utilisateur (table Notification) pour la cloche de l'en-tête. */
export async function getShellNotifications(db: TenantDb | PrismaClient, utilisateurId: string) {
  const [unread, items] = await Promise.all([
    db.notification.count({ where: { utilisateurId, lue: false } }),
    db.notification.findMany({
      where: { utilisateurId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, titre: true, message: true, createdAt: true, lue: true },
    }),
  ]);
  return {
    unread,
    items: items.map(({ createdAt, ...item }) => ({ ...item, at: createdAt.toISOString() })),
  };
}
