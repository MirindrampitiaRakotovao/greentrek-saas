import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { RegisterAgencyForm } from "@/components/auth/register-agency-form";

export const metadata: Metadata = { title: "Inscrire votre agence — Green Trek" };

export default function InscriptionAgencePage() {
  return (
    <AuthCard
      title="Inscrire votre agence"
      subtitle="Créez votre espace et votre site vitrine. Période d'essai gratuite de 30 jours."
      footer={
        <>
          Déjà inscrit ?{" "}
          <Link href="/connexion" className="font-medium text-gt-teal-700 underline">
            Se connecter
          </Link>
        </>
      }
    >
      <RegisterAgencyForm />
    </AuthCard>
  );
}
