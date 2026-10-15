import type { Metadata } from "next";
import Link from "next/link";

import { AuthLayout } from "@/components/auth/auth-layout";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { loadAgencyAuth } from "@/lib/auth/agency-auth";

export const metadata: Metadata = { title: "Mot de passe oublié" };

/** Mot de passe oublié d'un voyageur : compte de l'agence du site uniquement. */
export default async function AgencyForgotPasswordPage({
  params,
}: PageProps<"/a/[slug]/mot-de-passe-oublie">) {
  const { slug } = await params;
  const { agence, brand, showcase } = await loadAgencyAuth(slug);
  return (
    <AuthLayout
      brand={brand}
      title="Mot de passe oublié ?"
      subtitle="Indiquez l'adresse e-mail de votre compte voyageur : nous vous envoyons un lien pour choisir un nouveau mot de passe."
      footer={
        <Link href={`/a/${slug}/connexion`} className="font-medium text-gt-teal-700 underline">
          ← Retour à la connexion
        </Link>
      }
      showcase={showcase}
    >
      <ForgotPasswordForm agenceSlug={agence.slug} />
    </AuthLayout>
  );
}
