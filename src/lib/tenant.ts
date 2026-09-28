import type { PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  type ModelConfig,
  type ModelName,
  type ReferenceTarget,
  TENANT_CONFIG,
} from "@/lib/tenant-config";

/**
 * Helper multi-tenant (cahier des charges §4).
 *
 * `getTenantDb(agenceId)` renvoie un client Prisma dont CHAQUE requête est confinée à une
 * agence. C'est le seul accès aux données métier autorisé dans les pages et les actions
 * (règle ESLint `no-restricted-imports` sur `@/lib/db`).
 *
 * Mécanisme : une extension Prisma (`$extends` + `query.$allModels.$allOperations`)
 * intercepte toutes les opérations avant leur envoi à MySQL :
 * 1. lectures, modifications, suppressions : ajout d'une condition d'agence au `where` ;
 * 2. créations : `agenceId` imposé (une autre valeur est refusée) ;
 * 3. références : toute clé étrangère écrite doit viser une ligne de la même agence
 *    (ex. un tronçon ne peut pas relier une étape d'une autre agence, RG 6 et RG 20) ;
 * 4. écritures imbriquées (`create`, `connect`… dans `data`) interdites : elles
 *    échapperaient aux contrôles 2 et 3.
 */

export class TenantViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantViolationError";
  }
}

const WHERE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]);
// MySQL ne propose pas `createManyAndReturn` ni `updateManyAndReturn`.
const CREATE_OPERATIONS = new Set(["create", "createMany"]);
const UPDATE_OPERATIONS = new Set(["update", "updateMany"]);
const READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

/** Opérations d'écriture imbriquée sur une relation (le `set` scalaire reste autorisé). */
const NESTED_WRITE_KEYS = new Set([
  "create",
  "createMany",
  "connect",
  "connectOrCreate",
  "disconnect",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]);

type Data = Record<string, unknown>;

function isPlainObject(value: unknown): value is Data {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date)
  );
}

function scopeCondition(config: ModelConfig, agenceId: string): Data | null {
  switch (config.scope.kind) {
    case "tenant":
      return { agenceId };
    case "child":
      return { [config.scope.relation]: { agenceId } };
    case "root":
      return { id: agenceId };
    case "global":
      return null;
  }
}

/** Ajoute la condition d'agence au `where`, en conservant les conditions existantes. */
function withScope(where: unknown, scope: Data): Data {
  const current = isPlainObject(where) ? where : {};
  const existingAnd =
    current.AND === undefined ? [] : Array.isArray(current.AND) ? current.AND : [current.AND];
  return { ...current, AND: [scope, ...existingAnd] };
}

function assertNoNestedWrites(model: ModelName, config: ModelConfig, data: Data): void {
  for (const [field, value] of Object.entries(data)) {
    if (config.jsonFields?.includes(field) || !isPlainObject(value)) continue;
    const isNestedWrite =
      Object.keys(value).some((key) => NESTED_WRITE_KEYS.has(key)) || Array.isArray(value.set);
    if (isNestedWrite) {
      throw new TenantViolationError(
        `Écriture imbriquée interdite via le client tenant (${model}.${field}) : utiliser les clés étrangères.`,
      );
    }
  }
}

/** Extrait la valeur écrite dans une clé étrangère (valeur directe ou `{ set: valeur }`). */
function writtenId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (isPlainObject(value) && typeof value.set === "string") return value.set;
  return null;
}

function createReferenceChecker(base: PrismaClient) {
  const belongsTo: Record<ReferenceTarget, (id: string, agenceId: string) => Promise<number>> = {
    Utilisateur: (id, agenceId) => base.utilisateur.count({ where: { id, agenceId } }),
    Etape: (id, agenceId) => base.etape.count({ where: { id, agenceId } }),
    Circuit: (id, agenceId) => base.circuit.count({ where: { id, agenceId } }),
    Guide: (id, agenceId) => base.guide.count({ where: { id, agenceId } }),
    SessionDepart: (id, agenceId) => base.sessionDepart.count({ where: { id, agenceId } }),
    Reservation: (id, agenceId) => base.reservation.count({ where: { id, agenceId } }),
    Partenaire: (id, agenceId) => base.partenaire.count({ where: { id, agenceId } }),
  };

  return async function assertReferences(
    model: ModelName,
    config: ModelConfig,
    data: Data,
    agenceId: string,
  ): Promise<void> {
    for (const [field, target] of Object.entries(config.references)) {
      const id = writtenId(data[field]);
      if (id === null) continue; // champ absent ou mis à null
      if ((await belongsTo[target](id, agenceId)) === 0) {
        throw new TenantViolationError(
          `${model}.${field} : la ressource ${target} référencée n'appartient pas à l'agence.`,
        );
      }
    }
  };
}

function createTenantClient(base: PrismaClient, agenceId: string) {
  const assertReferences = createReferenceChecker(base);

  async function prepareCreate(
    model: ModelName,
    config: ModelConfig,
    data: unknown,
  ): Promise<Data> {
    if (!isPlainObject(data))
      throw new TenantViolationError(`${model} : données de création invalides.`);
    assertNoNestedWrites(model, config, data);
    const prepared: Data = { ...data };
    if (config.scope.kind === "tenant") {
      if (data.agenceId !== undefined && data.agenceId !== agenceId) {
        throw new TenantViolationError(`${model} : création pour une autre agence refusée.`);
      }
      prepared.agenceId = agenceId;
    }
    await assertReferences(model, config, prepared, agenceId);
    return prepared;
  }

  async function checkUpdate(model: ModelName, config: ModelConfig, data: unknown): Promise<void> {
    if (!isPlainObject(data))
      throw new TenantViolationError(`${model} : données de modification invalides.`);
    assertNoNestedWrites(model, config, data);
    if ("agenceId" in data && writtenId(data.agenceId) !== agenceId) {
      throw new TenantViolationError(`${model} : changement d'agence refusé.`);
    }
    await assertReferences(model, config, data, agenceId);
  }

  return base.$extends({
    name: "tenant",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const config = TENANT_CONFIG[model];
          const next: Data = { ...(args as Data) };

          if (config.scope.kind === "global" && !READ_OPERATIONS.has(operation)) {
            throw new TenantViolationError(`${model} : table en lecture seule pour une agence.`);
          }
          if (
            config.scope.kind === "root" &&
            (CREATE_OPERATIONS.has(operation) ||
              operation.startsWith("delete") ||
              operation === "upsert")
          ) {
            throw new TenantViolationError(`${model} : opération réservée au super admin.`);
          }

          const scope = scopeCondition(config, agenceId);
          if (scope && WHERE_OPERATIONS.has(operation)) {
            next.where = withScope(next.where, scope);
          }

          if (operation === "create") {
            next.data = await prepareCreate(model, config, next.data);
          } else if (operation === "createMany") {
            const rows = Array.isArray(next.data) ? next.data : [next.data];
            next.data = await Promise.all(rows.map((row) => prepareCreate(model, config, row)));
          } else if (UPDATE_OPERATIONS.has(operation)) {
            await checkUpdate(model, config, next.data);
          } else if (operation === "upsert") {
            next.create = await prepareCreate(model, config, next.create);
            await checkUpdate(model, config, next.update);
          }

          return query(next as typeof args);
        },
      },
    },
  });
}

type ExtendedTenantClient = ReturnType<typeof createTenantClient>;

/**
 * Client confiné à une agence. Les requêtes SQL brutes sont retirées du type : elles
 * contourneraient l'extension.
 */
export type TenantDb = Omit<
  ExtendedTenantClient,
  "$queryRaw" | "$queryRawUnsafe" | "$executeRaw" | "$executeRawUnsafe"
>;

/** Client Prisma confiné à l'agence `agenceId`. `base` n'est fourni que par les tests. */
export function getTenantDb(agenceId: string, base: PrismaClient = db): TenantDb {
  if (!agenceId) {
    throw new TenantViolationError("getTenantDb : agenceId manquant.");
  }
  return createTenantClient(base, agenceId);
}
