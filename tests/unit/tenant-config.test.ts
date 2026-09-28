import { describe, expect, it } from "vitest";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "@/generated/prisma/client";
import { TENANT_CONFIG } from "@/lib/tenant-config";

/**
 * Garde-fou : la configuration explicite du helper tenant doit rester alignée sur le
 * schéma Prisma. Si on ajoute une table ou une clé étrangère sans mettre à jour
 * TENANT_CONFIG, ce test échoue.
 *
 * Le modèle de données est lu sur `_runtimeDataModel`, une propriété interne de Prisma.
 * Elle n'est utilisée que dans ce test, jamais dans le code applicatif.
 */
type RuntimeField = { name: string; kind: string; type: string };
type RuntimeDataModel = { models: Record<string, { fields: RuntimeField[] }> };

// Aucune connexion n'est ouverte : le client n'exécute aucune requête.
const client = new PrismaClient({
  adapter: new PrismaMariaDb({ host: "localhost", database: "inutilise" }),
});
const { models } = (client as unknown as { _runtimeDataModel: RuntimeDataModel })._runtimeDataModel;

/** Clés étrangères non contrôlées : l'agence elle-même et le plan (table globale). */
const UNCONTROLLED_FOREIGN_KEYS = new Set(["agenceId", "planId"]);
/** Champs en « …Id » qui ne sont pas des clés étrangères (identifiant polymorphe de l'audit). */
const NOT_FOREIGN_KEYS = new Set(["JournalActivite.entiteId"]);

describe("configuration du helper tenant", () => {
  it("couvre exactement les tables du schéma", () => {
    expect(Object.keys(TENANT_CONFIG).sort()).toEqual(Object.keys(models).sort());
  });

  for (const [model, { fields }] of Object.entries(models)) {
    const config = TENANT_CONFIG[model as keyof typeof TENANT_CONFIG];
    const scalarNames = fields.filter((f) => f.kind === "scalar").map((f) => f.name);

    it(`${model} : contrôle toutes ses clés étrangères`, () => {
      const foreignKeys = scalarNames.filter(
        (name) =>
          name.endsWith("Id") &&
          !UNCONTROLLED_FOREIGN_KEYS.has(name) &&
          !NOT_FOREIGN_KEYS.has(`${model}.${name}`),
      );
      expect(Object.keys(config.references).sort()).toEqual(foreignKeys.sort());
    });

    it(`${model} : déclare tous ses champs JSON`, () => {
      const jsonFields = fields
        .filter((f) => f.kind === "scalar" && f.type === "Json")
        .map((f) => f.name);
      expect([...(config.jsonFields ?? [])].sort()).toEqual(jsonFields.sort());
    });

    it(`${model} : sa portée correspond à ses champs`, () => {
      const scope = config.scope;
      if (scope.kind === "tenant") {
        expect(scalarNames).toContain("agenceId");
      } else if (scope.kind === "child") {
        expect(scalarNames).not.toContain("agenceId");
        expect(fields.map((f) => f.name)).toContain(scope.relation);
      } else {
        expect(["Agence", "Plan"]).toContain(model);
      }
    });
  }
});
