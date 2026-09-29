import type { Prisma } from "@/generated/prisma/client";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import type { TenantDb } from "@/lib/tenant";
import type { EtapeInput } from "@/lib/validators/circuits";

/**
 * Étapes de l'agence : les NŒUDS du graphe (§6.1), réutilisables entre circuits (RG 5).
 * RG 8 : une étape reliée par un tronçon ou utilisée par un circuit ne peut pas être
 * supprimée. La base le garantit déjà (clés étrangères RESTRICT) ; le service vérifie
 * avant pour afficher un message clair indiquant ce qui l'utilise.
 */

const etapeSelect = {
  id: true,
  nom: true,
  type: true,
  description: true,
  latitude: true,
  longitude: true,
  altitudeM: true,
  // Circuits qui passent par ce lieu (fiche du lieu sur la carte).
  circuits: {
    select: { circuit: { select: { id: true, titre: true } } },
    orderBy: { circuit: { titre: "asc" } },
  },
  _count: {
    select: {
      tronconsDepart: true,
      tronconsArrivee: true,
      circuits: true,
      circuitPartenaires: true,
    },
  },
} satisfies Prisma.EtapeSelect;

export type EtapeRow = Prisma.EtapeGetPayload<{ select: typeof etapeSelect }>;

/** Toutes les étapes (pas de pagination : elles sont affichées ensemble sur la carte). */
export function listEtapes(db: TenantDb): Promise<EtapeRow[]> {
  return db.etape.findMany({ select: etapeSelect, orderBy: { nom: "asc" } });
}

export function getEtape(db: TenantDb, id: string): Promise<EtapeRow | null> {
  return db.etape.findUnique({ where: { id }, select: etapeSelect });
}

export async function createEtape(
  db: TenantDb,
  agenceId: string,
  input: EtapeInput,
): Promise<ServiceResult<{ id: string }>> {
  const created = await db.etape.create({ data: { ...input, agenceId } });
  return success({ id: created.id });
}

export async function updateEtape(
  db: TenantDb,
  id: string,
  input: Partial<EtapeInput>,
): Promise<ServiceResult> {
  const result = await db.etape.updateMany({ where: { id }, data: input });
  return result.count === 1 ? success(undefined) : failure("Étape introuvable.");
}

export async function deleteEtape(db: TenantDb, id: string): Promise<ServiceResult> {
  const etape = await getEtape(db, id);
  if (!etape) return failure("Étape introuvable.");
  const { tronconsDepart, tronconsArrivee, circuits, circuitPartenaires } = etape._count;
  const usages = [
    tronconsDepart + tronconsArrivee > 0 ? `${tronconsDepart + tronconsArrivee} tronçon(s)` : null,
    circuits > 0 ? `${circuits} étape(s) de circuit` : null,
    circuitPartenaires > 0 ? `${circuitPartenaires} prestation(s) de partenaire` : null,
  ].filter(Boolean);
  if (usages.length > 0) {
    // RG 8
    return failure(`Suppression impossible : cette étape est utilisée par ${usages.join(", ")}.`);
  }
  await db.etape.delete({ where: { id } });
  return success(undefined);
}
