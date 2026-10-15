import type { Metadata } from "next";
import Link from "next/link";

import { AuthLayout } from "@/components/auth/auth-layout";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getAdminDb } from "@/lib/admin-db";
import { platformShowcase } from "@/lib/auth/showcase";
import { checkResetToken } from "@/lib/services/mot-de-passe";

// Le jeton est dans l'adresse : il ne doit fuiter ni vers un autre site, ni dans un index.
export const metadata: Metadata = {
  title: "Nouveau mot de passe — Green Trek",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

/** Nouveau mot de passe depuis le lien reçu par e-mail (personnel et super admin). */
export default async function ReinitialiserPage({
  searchParams,
}: PageProps<"/reinitialiser-mot-de-passe">) {
  const jeton = (await searchParams).jeton;
  const valide =
    typeof jeton === "string" ? await checkResetToken(getAdminDb(), jeton, null) : null;
  return (
    <AuthLayout
      brand={{ kind: "plateforme" }}
      title={valide ? "Nouveau mot de passe" : "Lien expiré"}
      subtitle={
        valide
          ? `Bonjour ${valide.prenom}, choisissez votre nouveau mot de passe.`
          : "Ce lien n'est plus valable : il a déjà servi ou date de plus d'une heure."
      }
      footer={
        <Link href="/connexion" className="font-medium text-gt-teal-700 underline">
          ← Retour à la connexion
        </Link>
      }
      showcase={platformShowcase()}
    >
      {valide && typeof jeton === "string" ? (
        <ResetPasswordForm jeton={jeton} />
      ) : (
        <Link
          href="/mot-de-passe-oublie"
          className="flex h-14 w-full items-center justify-center rounded-xl bg-gt-teal-900 font-semibold text-white hover:bg-gt-teal-800"
        >
          Demander un nouveau lien
        </Link>
      )}
    </AuthLayout>
  );
}
