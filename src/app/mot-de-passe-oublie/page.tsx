import type { Metadata } from "next";
import Link from "next/link";

import { AuthLayout } from "@/components/auth/auth-layout";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { platformShowcase } from "@/lib/auth/showcase";

export const metadata: Metadata = { title: "Mot de passe oublié — Green Trek" };

/** Mot de passe oublié : personnel des agences et super admin. */
export default function MotDePasseOubliePage() {
  return (
    <AuthLayout
      brand={{ kind: "plateforme" }}
      title="Mot de passe oublié ?"
      subtitle="Indiquez l'adresse e-mail de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe."
      footer={
        <Link href="/connexion" className="font-medium text-gt-teal-700 underline">
          ← Retour à la connexion
        </Link>
      }
      showcase={platformShowcase()}
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
