import type { Metadata } from "next";

import { AuthLayout } from "@/components/auth/auth-layout";
import { ClientRegistrationForm } from "@/components/auth/client-registration-form";
import { loadAgencyAuth } from "@/lib/auth/agency-auth";
import { safeReturnPath } from "@/lib/auth/return-path";
import { getPublicAgency } from "@/lib/public-agency";

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export async function generateMetadata({
  params,
}: PageProps<"/a/[slug]/inscription">): Promise<Metadata> {
  const agence = await getPublicAgency((await params).slug);
  return { title: agence ? `Créer un compte — ${agence.nom}` : "Agence introuvable" };
}

/** Inscription d'un voyageur (§7.2), rattaché à l'agence du site (RG 2, RG 3). */
export default async function ClientRegistrationPage({
  params,
  searchParams,
}: PageProps<"/a/[slug]/inscription">) {
  const { slug } = await params;
  const { agence, brand, showcase } = await loadAgencyAuth(slug);
  const retour = safeReturnPath(firstParam((await searchParams).retour), slug) ?? undefined;
  const suffixe = retour ? `?retour=${encodeURIComponent(retour)}` : "";

  return (
    <AuthLayout
      brand={brand}
      tabs={{
        active: "inscription",
        connexion: `/a/${slug}/connexion${suffixe}`,
        inscription: { href: `/a/${slug}/inscription${suffixe}`, label: "Créer un compte" },
      }}
      title="Commencez l'aventure"
      subtitle="Votre compte voyageur vous permet de réserver et de suivre vos voyages."
      footer={
        <span className="text-xs text-gt-teal-900/75">
          Nous ne collectons que les informations nécessaires à vos réservations.
        </span>
      }
      showcase={showcase}
    >
      <ClientRegistrationForm agenceSlug={agence.slug} retour={retour} />
    </AuthLayout>
  );
}
