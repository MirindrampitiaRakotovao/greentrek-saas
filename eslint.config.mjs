import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // CLAUDE.md : pas de `any`.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // Multi-tenant (CLAUDE.md, cahier des charges §4) : le client Prisma brut ne doit pas
    // être utilisé dans l'application. Passer par getTenantDb() (src/lib/tenant.ts).
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/tenant.ts", "src/lib/admin-db.ts", "src/app/api/health/route.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db",
              message:
                "Client Prisma brut interdit : utiliser getTenantDb(agenceId) de @/lib/tenant (ou getAdminDb() pour le super admin).",
            },
          ],
        },
      ],
    },
  },
  // Désactive les règles de style qui entreraient en conflit avec Prettier (toujours en dernier).
  prettier,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**"]),
]);

export default eslintConfig;
