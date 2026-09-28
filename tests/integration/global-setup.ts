import { execFileSync } from "node:child_process";

import "dotenv/config";

import { getTestDatabaseUrl } from "./test-db";

/**
 * Exécuté une fois avant les tests d'intégration : remet la base de test à zéro et
 * y applique toutes les migrations (y compris les contraintes CHECK écrites à la main).
 */
export default function setup(): void {
  const testDatabaseUrl = getTestDatabaseUrl();

  try {
    execFileSync("npx", ["prisma", "migrate", "reset", "--force"], {
      // La CLI Prisma lit DATABASE_URL via prisma.config.ts ; dotenv ne remplace pas une
      // variable déjà définie, donc c'est bien la base de test qui est visée.
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      stdio: "pipe",
    });
  } catch (error: unknown) {
    const stderr =
      error instanceof Error && "stderr" in error ? String(error.stderr).trim() : String(error);
    throw new Error(
      "Impossible de préparer la base de test. Vérifiez qu'elle existe " +
        "(mysql -u root -p < scripts/init-db.sql) et que TEST_DATABASE_URL est correct.\n" +
        stderr,
    );
  }
}
