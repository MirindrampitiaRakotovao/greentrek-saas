import type { Metadata } from "next";

import { PlaceholderSpace } from "@/components/layout/placeholder-space";
import { requireUser } from "@/lib/auth/session";
import { getPublicAgency } from "@/lib/public-agency";

export const metadata: Metadata = { title: "Mon compte" };

/** Espace client provisoire (E2) : réservations et profil arrivent en E9. */
export default async function MonComptePage({ params }: PageProps<"/a/[slug]/mon-compte">) {
  const { slug } = await params;
  // Le client doit appartenir à l'agence de l'URL (sinon renvoi vers son propre espace).
  const user = await requireUser({ roles: ["CLIENT"], agenceSlug: slug });
  const agence = await getPublicAgency(slug);

  return <PlaceholderSpace title="Mon compte" user={user} agenceNom={agence?.nom} />;
}
