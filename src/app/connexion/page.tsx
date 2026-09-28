import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Connexion — Green Trek" };

/** Connexion du personnel des agences et du super admin (les clients passent par /a/[slug]). */
export default function ConnexionPage() {
  return (
    <AuthCard
      title="Connexion"
      subtitle="Espace des agences et administration de la plateforme."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link href="/inscription-agence" className="font-medium text-gt-teal-700 underline">
            Inscrire votre agence
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
