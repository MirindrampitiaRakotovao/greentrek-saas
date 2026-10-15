import type { Metadata } from "next";
import Link from "next/link";

import { AuthLayout } from "@/components/auth/auth-layout";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getAdminDb } from "@/lib/admin-db";
import { loadAgencyAuth } from "@/lib/auth/agency-auth";
import { checkResetToken } from "@/lib/services/mot-de-passe";

// Le jeton est dans l'adresse : il ne doit fuiter ni vers un autre site, ni dans un index.
export const metadata: Metadata = {
  title: "Nouveau mot de passe",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

/** Nouveau mot de passe d'un voyageur depuis le lien reçu par e-mail. */
export default async function AgencyResetPasswordPage({
  params,
  searchParams,
}: PageProps<"/a/[slug]/reinitialiser-mot-de-passe">) {
  const { slug } = await params;
  const { agence, brand, showcase } = await loadAgencyAuth(slug);
  const jeton = (await searchParams).jeton;
  const valide =
    typeof jeton === "string" ? await checkResetToken(getAdminDb(), jeton, agence.slug) : null;
  return (
    <AuthLayout
      brand={brand}
      title={valide ? "Nouveau mot de passe" : "Lien expiré"}
      subtitle={
        valide
          ? `Bonjour ${valide.prenom}, choisissez votre nouveau mot de passe.`
          : "Ce lien n'est plus valable : il a déjà servi ou date de plus d'une heure."
      }
      footer={
        <Link href={`/a/${slug}/connexion`} className="font-medium text-gt-teal-700 underline">
          ← Retour à la connexion
        </Link>
      }
      showcase={showcase}
    >
      {valide && typeof jeton === "string" ? (
        <ResetPasswordForm jeton={jeton} agenceSlug={agence.slug} />
      ) : (
        <Link
          href={`/a/${slug}/mot-de-passe-oublie`}
          className="flex h-14 w-full items-center justify-center rounded-xl bg-gt-teal-900 font-semibold text-white hover:bg-gt-teal-800"
        >
          Demander un nouveau lien
        </Link>
      )}
    </AuthLayout>
  );
}
