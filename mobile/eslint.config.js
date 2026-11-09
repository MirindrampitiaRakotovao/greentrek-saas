// Configuration ESLint de l'application mobile (indépendante de celle du site).
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      // Comme sur le site : pas de `any`.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  { ignores: ["dist/*", ".expo/*"] },
]);
