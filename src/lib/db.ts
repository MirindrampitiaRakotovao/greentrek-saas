import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Crée un client Prisma pour l'URL MySQL donnée.
 *
 * Prisma 7 passe par un « driver adapter » : ici le pilote `mariadb`, compatible MySQL.
 * Exportée pour que les tests d'intégration visent explicitement la base de test.
 */
export function createPrismaClient(databaseUrl: string): PrismaClient {
  const url = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 5,
    // MySQL 8 authentifie par défaut avec `caching_sha2_password` ; sans TLS, le pilote
    // doit récupérer la clé publique du serveur. Acceptable uniquement en local (démo).
    allowPublicKeyRetrieval: true,
  });

  return new PrismaClient({ adapter });
}

function createDefaultClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL n'est pas défini : copiez .env.example en .env.");
  }
  return createPrismaClient(databaseUrl);
}

/**
 * Client Prisma unique de l'application.
 *
 * En développement, le rechargement à chaud de Next.js réévalue les modules : on garde
 * l'instance sur `globalThis` pour ne pas ouvrir un nouveau pool de connexions à chaque
 * modification de fichier.
 *
 * Attention : ce client est « brut ». À partir de l'étape E2, les tables liées à une
 * agence ne doivent être lues ou écrites qu'au travers du helper tenant (`src/lib/tenant.ts`).
 */
// Typé largement : l'instance en cache peut venir d'une version antérieure du client généré.
const globalForPrisma = globalThis as unknown as {
  prisma?: { $disconnect: () => Promise<void> };
};

// Après un `prisma generate` (nouveau schéma), la classe PrismaClient change : une instance
// mise en cache par l'ancienne version ne connaît pas les nouvelles tables. On ne la
// réutilise donc que si elle provient de la classe actuelle.
const cached = globalForPrisma.prisma;
if (cached && !(cached instanceof PrismaClient)) {
  void cached.$disconnect();
}

export const db: PrismaClient = cached instanceof PrismaClient ? cached : createDefaultClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
