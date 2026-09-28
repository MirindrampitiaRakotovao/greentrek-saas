import path from "node:path";

import { defineConfig } from "vitest/config";

// Tests unitaires (algorithmes de graphe, isolation tenant) : environnement Node,
// sans navigateur simulé. L'alias `@` reprend celui de tsconfig.json.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
});
