import type { Prisma } from "@/generated/prisma/client";
import { type Paginated, pageArgs, pageCount } from "@/lib/pagination";
import { failure, type ServiceResult, success } from "@/lib/services/result";
import type { TenantDb } from "@/lib/tenant";
import type { PartenaireInput } from "@/lib/validators/backoffice";

/**
 * Partenaires de l'agence (hébergement, restauration, activités, transport).
 * Suppression possible seulement si le partenaire n'est inclus dans aucun circuit ;
 * sinon on le désactive (décision D de l'étape E3).
 */

const partenaireSelect = {
  id: true,
  nom: true,
  type: true,
  description: true,
  telephone: true,
  email: true,
  adresse: true,
  latitude: true,
  longitude: true,
  tarifIndicatif: true,
  imageUrl: true,
  actif: true,
  _count: { select: { circuits: true } },
} satisfies Prisma.PartenaireSelect;

export type PartenaireRow = Prisma.PartenaireGetPayload<{ select: typeof partenaireSelect }>;

export async function listPartenaires(
  db: TenantDb,
  page: number,
): Promise<Paginated<PartenaireRow>> {
  const [items, total] = await Promise.all([
    db.partenaire.findMany({
      select: partenaireSelect,
      orderBy: [{ actif: "desc" }, { nom: "asc" }],
      ...pageArgs(page),
    }),
    db.partenaire.count(),
  ]);
  return { items, total, page, pageCount: pageCount(total) };
}

export function getPartenaire(db: TenantDb, id: string): Promise<PartenaireRow | null> {
  return db.partenaire.findUnique({ where: { id }, select: partenaireSelect });
}

export async function createPartenaire(
  db: TenantDb,
  agenceId: string,
  input: PartenaireInput,
): Promise<ServiceResult<{ id: string }>> {
  const created = await db.partenaire.create({ data: { ...input, agenceId } });
  return success({ id: created.id });
}

export async function updatePartenaire(
  db: TenantDb,
  id: string,
  input: PartenaireInput,
): Promise<ServiceResult> {
  const result = await db.partenaire.updateMany({ where: { id }, data: input });
  return result.count === 1 ? success(undefined) : failure("Partenaire introuvable.");
}

export async function deletePartenaire(db: TenantDb, id: string): Promise<ServiceResult> {
  const partenaire = await getPartenaire(db, id);
  if (!partenaire) return failure("Partenaire introuvable.");
  const usages = partenaire._count.circuits;
  if (usages > 0) {
    return failure(
      `Ce partenaire est inclus dans ${usages} circuit${usages > 1 ? "s" : ""} : désactivez-le plutôt que de le supprimer.`,
    );
  }
  await db.partenaire.delete({ where: { id } });
  return success(undefined);
}
