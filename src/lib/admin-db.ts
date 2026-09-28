import type { PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db";

/**
 * Accès non confiné, réservé au SUPER_ADMIN (console `/admin`) et à l'authentification
 * (recherche d'un compte avant de connaître son agence).
 *
 * Ce module est l'une des seules exceptions à la règle ESLint qui interdit d'importer
 * `@/lib/db` : chaque appel doit être précédé d'une vérification du rôle SUPER_ADMIN
 * ou se limiter à l'authentification.
 */
export function getAdminDb(): PrismaClient {
  return db;
}
