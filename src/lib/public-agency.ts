import { cache } from "react";

import { getAdminDb } from "@/lib/admin-db";

/**
 * Informations publiques d'une agence à partir du slug de l'URL (site vitrine, connexion
 * client). Lecture non confinée car l'agence n'est pas encore connue ; seuls des champs
 * publics sont renvoyés. RG 19 : une agence suspendue n'est plus accessible au public.
 */
export const getPublicAgency = cache(async (slug: string) => {
  return getAdminDb().agence.findFirst({
    where: { slug, statut: "ACTIVE" },
    select: { id: true, nom: true, slug: true },
  });
});
