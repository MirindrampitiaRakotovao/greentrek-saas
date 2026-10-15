import { cache } from "react";

import type { PrismaClient } from "@/generated/prisma/client";
import { getAdminDb } from "@/lib/admin-db";

/**
 * Informations publiques d'une agence à partir du slug de l'URL (site vitrine, connexion
 * client). Lecture non confinée car l'agence n'est pas encore connue ; seuls des champs
 * publics sont renvoyés. RG 19 : une agence suspendue n'est plus accessible au public.
 */
export const getPublicAgency = cache(async (slug: string) => {
  return getAdminDb().agence.findFirst({
    where: { slug, statut: "ACTIVE" },
    select: { id: true, nom: true, slug: true, logoUrl: true },
  });
});

/**
 * Agence affichée sur son site vitrine (§7.1) : uniquement des champs publics (présentation,
 * coordonnées de contact, devise). RG 19 : agence ACTIVE seulement. Le client est passé en
 * paramètre pour être testé sur la base de test ; les pages utilisent `getVitrineAgency`.
 */
export function findVitrineAgency(base: PrismaClient, slug: string) {
  return base.agence.findFirst({
    where: { slug, statut: "ACTIVE" },
    select: {
      id: true,
      nom: true,
      slug: true,
      description: true,
      logoUrl: true,
      email: true,
      telephone: true,
      adresse: true,
      ville: true,
      pays: true,
      devise: true,
    },
  });
}

export const getVitrineAgency = cache((slug: string) => findVitrineAgency(getAdminDb(), slug));

export type VitrineAgency = NonNullable<Awaited<ReturnType<typeof findVitrineAgency>>>;

/**
 * Agences présentées sur la landing de la plateforme : agences ACTIVES seulement (RG 19),
 * champs publics (nom, ville, lien du site vitrine).
 */
export const listPublicAgencies = cache(() =>
  getAdminDb().agence.findMany({
    where: { statut: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    take: 6,
    select: { id: true, nom: true, slug: true, ville: true, description: true },
  }),
);
