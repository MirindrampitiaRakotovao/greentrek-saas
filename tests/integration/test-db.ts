import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/db";

/**
 * URL de la base de test. Garde-fou : on refuse toute base dont le nom ne se termine pas
 * par `_test`, pour ne jamais vider la base de développement par erreur.
 */
export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL n'est pas défini (voir .env.example).");
  }
  if (!new URL(url).pathname.endsWith("_test")) {
    throw new Error("TEST_DATABASE_URL doit viser une base dont le nom se termine par _test.");
  }
  return url;
}

export function createTestClient(): PrismaClient {
  return createPrismaClient(getTestDatabaseUrl());
}

/** Vide toutes les tables métier (entre deux tests), sans toucher à l'historique des migrations. */
export async function truncateAll(client: PrismaClient): Promise<void> {
  const tables = await client.$queryRaw<{ name: string }[]>`
    SELECT TABLE_NAME AS name FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> '_prisma_migrations'`;

  await client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
    for (const { name } of tables) {
      // Noms issus d'information_schema (pas d'entrée utilisateur).
      await tx.$executeRawUnsafe(`TRUNCATE TABLE \`${name}\``);
    }
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
  });
}
