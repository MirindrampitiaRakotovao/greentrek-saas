import { AsyncLocalStorage } from "node:async_hooks";

import type { PrismaClient } from "@/generated/prisma/client";
import { runWithCommitHooks } from "@/lib/after-commit";
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
 *
 * Transactions : utiliser `db.$tenantTransaction(async (tx) => …)`. Les contrôles de
 * références s'exécutent alors dans la transaction et voient ses écritures non encore
 * validées (ex. créer un utilisateur puis sa fiche Guide dans la même transaction).
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

/** Accès minimal utilisé par le contrôle des références : un `count` par table cible. */
type Counter = { count(args: { where: { id: string } }): Promise<number> };
type ReferenceReader = Record<
  | "utilisateur"
  | "etape"
  | "circuit"
  | "guide"
  | "sessionDepart"
  | "reservation"
  | "partenaire"
  | "conversation",
  Counter
>;

const TARGET_DELEGATE: Record<ReferenceTarget, keyof ReferenceReader> = {
  Utilisateur: "utilisateur",
  Etape: "etape",
  Circuit: "circuit",
  Guide: "guide",
  SessionDepart: "sessionDepart",
  Reservation: "reservation",
  Partenaire: "partenaire",
  Conversation: "conversation",
};

/**
 * Vérifie que chaque clé étrangère écrite vise une ligne visible par l'agence. Le comptage
 * passe par le client CONFINÉ (`reader`) : le filtre d'agence y est ajouté automatiquement,
 * et, dans une transaction, c'est le client de la transaction qui est utilisé.
 */
async function assertReferences(
  reader: ReferenceReader,
  model: ModelName,
  config: ModelConfig,
  data: Data,
): Promise<void> {
  for (const [field, target] of Object.entries(config.references)) {
    const id = writtenId(data[field]);
    if (id === null) continue; // champ absent ou mis à null
    if ((await reader[TARGET_DELEGATE[target]].count({ where: { id } })) === 0) {
      throw new TenantViolationError(
        `${model}.${field} : la ressource ${target} référencée n'appartient pas à l'agence.`,
      );
    }
  }
}

function extendForTenant(base: PrismaClient, agenceId: string, reader: () => ReferenceReader) {
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
    await assertReferences(reader(), model, config, prepared);
    return prepared;
  }

  async function checkUpdate(model: ModelName, config: ModelConfig, data: unknown): Promise<void> {
    if (!isPlainObject(data))
      throw new TenantViolationError(`${model} : données de modification invalides.`);
    assertNoNestedWrites(model, config, data);
    if ("agenceId" in data && writtenId(data.agenceId) !== agenceId) {
      throw new TenantViolationError(`${model} : changement d'agence refusé.`);
    }
    await assertReferences(reader(), model, config, data);
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

type ExtendedTenantClient = ReturnType<typeof extendForTenant>;

/** Requêtes SQL brutes : retirées des types, elles contourneraient l'extension. */
type RawMethods = "$queryRaw" | "$queryRawUnsafe" | "$executeRaw" | "$executeRawUnsafe";

/** Client d'une transaction confinée à l'agence. */
export type TenantTx = Omit<
  ExtendedTenantClient,
  RawMethods | "$transaction" | "$connect" | "$disconnect" | "$extends" | "$on"
>;

/**
 * Client confiné à une agence. `$transaction` est remplacé par `$tenantTransaction`, qui
 * fait exécuter les contrôles de références dans la transaction.
 */
export type TenantDb = Omit<ExtendedTenantClient, RawMethods | "$transaction"> & {
  $tenantTransaction<R>(fn: (tx: TenantTx) => Promise<R>): Promise<R>;
};

/** Client Prisma confiné à l'agence `agenceId`. `base` n'est fourni que par les tests. */
export function getTenantDb(agenceId: string, base: PrismaClient = db): TenantDb {
  if (!agenceId) {
    throw new TenantViolationError("getTenantDb : agenceId manquant.");
  }

  // Transaction en cours pour ce client (propagée à travers les `await` par Node).
  const currentTx = new AsyncLocalStorage<TenantTx>();
  const extended: ExtendedTenantClient = extendForTenant(
    base,
    agenceId,
    () => currentTx.getStore() ?? extended,
  );

  return extended.$extends({
    name: "tenant-transaction",
    client: {
      async $tenantTransaction<R>(fn: (tx: TenantTx) => Promise<R>): Promise<R> {
        return runWithCommitHooks(() =>
          extended.$transaction((tx) => currentTx.run(tx, () => fn(tx))),
        );
      },
    },
  });
}

export { afterCommit } from "@/lib/after-commit";
