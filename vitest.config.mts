import path from "node:path";

import { defineConfig } from "vitest/config";

// Deux projets de tests, en environnement Node :
// - unit : logique pure (algorithmes de graphe, utilitaires), sans base de données ;
// - integration : base MySQL de test (`TEST_DATABASE_URL`), remise à zéro au démarrage.
//   Les fichiers s'exécutent l'un après l'autre car ils partagent la même base.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts", "src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["dotenv/config"],
          globalSetup: ["tests/integration/global-setup.ts"],
          fileParallelism: false,
          testTimeout: 15_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
