import type { Metadata } from "next";
import Link from "next/link";

import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";
import { FormSuccess } from "@/components/ui/form-success";
import { loadAgencyAuth } from "@/lib/auth/agency-auth";
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
  const { agence, brand, showcase } = await loadAgencyAuth(slug);
  const query = await searchParams;
  // Retour au tunnel de réservation après connexion (chemin vérifié, sinon ignoré).
  const retour = safeReturnPath(firstParam(query.retour), slug) ?? undefined;
  const suffixe = retour ? `?retour=${encodeURIComponent(retour)}` : "";

  return (
    <AuthLayout
      brand={brand}
      tabs={{
        active: "connexion",
        connexion: `/a/${slug}/connexion${suffixe}`,
        inscription: { href: `/a/${slug}/inscription${suffixe}`, label: "Créer un compte" },
      }}
      title={retour ? "Connectez-vous pour réserver" : "Bon retour parmi nous"}
      subtitle={
        retour
          ? "Connectez-vous pour finaliser votre réservation."
          : `Espace voyageur de ${agence.nom} : vos réservations, vos factures et vos messages.`
      }
      notice={
        firstParam(query.reinitialise) === "1" ? (
          <FormSuccess message="Mot de passe modifié : connectez-vous avec votre nouveau mot de passe." />
        ) : null
      }
      footer={
        <>
          Vous faites partie de l&apos;équipe de l&apos;agence ?{" "}
          <Link href="/connexion" className="font-medium text-gt-teal-700 underline">
            Espace agence
          </Link>
        </>
      }
      showcase={showcase}
    >
      <LoginForm agenceSlug={agence.slug} retour={retour} />
    </AuthLayout>
  );
}
