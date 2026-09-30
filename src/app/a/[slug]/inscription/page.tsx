import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { ClientRegistrationForm } from "@/components/auth/client-registration-form";
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
  const agence = await getPublicAgency(slug);
  if (!agence) notFound();
  const retour = safeReturnPath(firstParam((await searchParams).retour), slug) ?? undefined;
  const connexion = `/a/${slug}/connexion${retour ? `?retour=${encodeURIComponent(retour)}` : ""}`;

  return (
    <AuthCard
      title={`Créer un compte — ${agence.nom}`}
      subtitle="Votre compte voyageur vous permet de réserver et de suivre vos voyages."
      footer={
        <>
          Déjà un compte ?{" "}
          <Link href={connexion} className="font-medium text-gt-teal-700 underline">
            Se connecter
          </Link>
          <br />
          <span className="text-xs text-gt-teal-900/75">
            Nous ne collectons que les informations nécessaires à vos réservations.
          </span>
        </>
      }
    >
      <ClientRegistrationForm agenceSlug={agence.slug} retour={retour} />
    </AuthCard>
  );
}
