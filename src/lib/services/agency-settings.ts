import { failure, type ServiceResult, success } from "@/lib/services/result";
import type { TenantDb } from "@/lib/tenant";
import type { AgencySettingsInput } from "@/lib/validators/backoffice";

/**
 * Paramètres de l'agence (§7.3). Le slug n'est pas modifiable : il fait partie des adresses
 * publiques du site vitrine (`/a/[slug]`), le changer casserait les liens existants.
 * La couleur principale (thème par agence) est une option P2, non traitée.
 */

export async function getAgencySettings(db: TenantDb, agenceId: string) {
  return db.agence.findUniqueOrThrow({
    where: { id: agenceId },
    select: {
      nom: true,
      slug: true,
      description: true,
      email: true,
      telephone: true,
      adresse: true,
      ville: true,
      pays: true,
      devise: true,
      logoUrl: true,
    },
  });
}

export async function updateAgencySettings(
  db: TenantDb,
  agenceId: string,
  input: AgencySettingsInput,
): Promise<ServiceResult> {
  // Client confiné : `updateMany` ne peut toucher que l'agence de l'utilisateur.
  const result = await db.agence.updateMany({ where: { id: agenceId }, data: input });
  return result.count === 1 ? success(undefined) : failure("Agence introuvable.");
}
