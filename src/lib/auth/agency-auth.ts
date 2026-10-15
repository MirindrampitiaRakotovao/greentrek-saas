import "server-only";

import { notFound } from "next/navigation";

import type { AuthBrand } from "@/components/auth/auth-layout";
import { agencyShowcase } from "@/lib/auth/showcase";
import { getPublicAgency } from "@/lib/public-agency";

/** Agence (active) d'une page d'authentification de son site, avec sa marque et ses photos. */
export async function loadAgencyAuth(slug: string) {
  const agence = await getPublicAgency(slug);
  if (!agence) notFound();
  const brand: AuthBrand = {
    kind: "agence",
    nom: agence.nom,
    logoUrl: agence.logoUrl,
    href: `/a/${agence.slug}`,
  };
  return { agence, brand, showcase: await agencyShowcase(agence) };
}
