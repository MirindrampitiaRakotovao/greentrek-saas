import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { safeReturnPath } from "@/lib/auth/return-path";
import { getPublicAgency } from "@/lib/public-agency";

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export async function generateMetadata({
  params,
}: PageProps<"/a/[slug]/connexion">): Promise<Metadata> {
  const agence = await getPublicAgency((await params).slug);
  return { title: agence ? `Connexion — ${agence.nom}` : "Agence introuvable" };
}

/** Connexion des clients d'une agence (uniquement les clients de CETTE agence). */
export default async function AgencyLoginPage({
  params,
  searchParams,
}: PageProps<"/a/[slug]/connexion">) {
  const { slug } = await params;
  const agence = await getPublicAgency(slug);
  if (!agence) notFound();
  // Retour au tunnel de réservation après connexion (chemin vérifié, sinon ignoré).
  const retour = safeReturnPath(firstParam((await searchParams).retour), slug) ?? undefined;
  const inscription = `/a/${slug}/inscription${retour ? `?retour=${encodeURIComponent(retour)}` : ""}`;

  return (
    <AuthCard
      title={`Connexion — ${agence.nom}`}
      subtitle={
        retour
          ? "Connectez-vous pour finaliser votre réservation."
          : "Espace voyageur : accédez à vos réservations."
      }
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link href={inscription} className="font-medium text-gt-teal-700 underline">
            Créer un compte voyageur
          </Link>
          <br />
          Vous faites partie de l&apos;équipe de l&apos;agence ?{" "}
          <Link href="/connexion" className="font-medium text-gt-teal-700 underline">
            Espace agence
          </Link>
        </>
      }
    >
      <LoginForm agenceSlug={agence.slug} retour={retour} />
    </AuthCard>
  );
}
