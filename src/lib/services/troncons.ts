import { Prisma } from "@/generated/prisma/client";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import type { TenantDb } from "@/lib/tenant";
import type { TronconInput } from "@/lib/validators/circuits";

/**
 * Tronçons de l'agence : les ARÊTES du graphe (§6.1). Règles appliquées :
 * - RG 6 : deux étapes distinctes de la même agence, distance > 0 (schéma Zod, helper tenant
 *   et contraintes CHECK de la base) ;
 * - RG 7 : un seul tronçon par couple (départ, arrivée) (index unique + message clair) ;
 * - doublon inverse (décision E1) : si A→B existe et que l'un des deux tronçons A→B ou B→A
 *   est bidirectionnel, ils décriraient deux fois le même sentier : refusé. Deux tronçons
 *   à sens unique A→B et B→A restent permis (ex. durées différentes à la montée et à la
 *   descente).
 */

const tronconSelect = {
  id: true,
  etapeDepartId: true,
  etapeArriveeId: true,
  distanceKm: true,
  dureeMinutes: true,
  deniveleM: true,
  difficulte: true,
  bidirectionnel: true,
  distanceEstimee: true,
  commentaire: true,
} satisfies Prisma.TronconSelect;

export type TronconRow = Prisma.TronconGetPayload<{ select: typeof tronconSelect }>;

export function listTroncons(db: TenantDb): Promise<TronconRow[]> {
  return db.troncon.findMany({ select: tronconSelect });
}

export function getTroncon(db: TenantDb, id: string): Promise<TronconRow | null> {
  return db.troncon.findUnique({ where: { id }, select: tronconSelect });
}

const DUPLICATE = "Un tronçon relie déjà ces deux étapes dans ce sens (RG 7).";
const REVERSE_DUPLICATE =
  "Le tronçon inverse existe déjà et l'un des deux est à double sens : modifiez le tronçon existant.";

/** Vérifie RG 7 et le doublon inverse, en ignorant le tronçon `exceptId` (modification). */
async function checkPair(
  db: TenantDb,
  input: TronconInput,
  exceptId?: string,
): Promise<ServiceResult> {
  const notSelf = exceptId ? { id: { not: exceptId } } : {};
  const same = await db.troncon.findFirst({
    where: { etapeDepartId: input.etapeDepartId, etapeArriveeId: input.etapeArriveeId, ...notSelf },
    select: { id: true },
  });
  if (same) return failure(DUPLICATE, "etapeArriveeId");

  const reverse = await db.troncon.findFirst({
    where: { etapeDepartId: input.etapeArriveeId, etapeArriveeId: input.etapeDepartId, ...notSelf },
    select: { bidirectionnel: true },
  });
  if (reverse && (reverse.bidirectionnel || input.bidirectionnel)) {
    return failure(REVERSE_DUPLICATE, "etapeArriveeId");
  }
  return success(undefined);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createTroncon(
  db: TenantDb,
  agenceId: string,
  input: TronconInput,
): Promise<ServiceResult<{ id: string }>> {
  const check = await checkPair(db, input);
  if (!check.ok) return check;
  try {
    // Le helper tenant vérifie que les deux étapes appartiennent à l'agence (RG 6, RG 20).
    const created = await db.troncon.create({ data: { ...input, agenceId } });
    return success({ id: created.id });
  } catch (error: unknown) {
    if (isUniqueViolation(error)) return failure(DUPLICATE, "etapeArriveeId");
    throw error;
  }
}

export async function updateTroncon(
  db: TenantDb,
  id: string,
  input: TronconInput,
): Promise<ServiceResult> {
  if (!(await getTroncon(db, id))) return failure("Tronçon introuvable.");
  const check = await checkPair(db, input, id);
  if (!check.ok) return check;
  try {
    await db.troncon.update({ where: { id }, data: input });
    return success(undefined);
  } catch (error: unknown) {
    if (isUniqueViolation(error)) return failure(DUPLICATE, "etapeArriveeId");
    throw error;
  }
}

export async function deleteTroncon(db: TenantDb, id: string): Promise<ServiceResult> {
  const result = await db.troncon.deleteMany({ where: { id } });
  return result.count === 1 ? success(undefined) : failure("Tronçon introuvable.");
}
