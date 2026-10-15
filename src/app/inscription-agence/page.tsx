import type { Metadata } from "next";

import { AuthLayout } from "@/components/auth/auth-layout";
import { RegisterAgencyForm } from "@/components/auth/register-agency-form";
import { platformShowcase } from "@/lib/auth/showcase";

export const metadata: Metadata = { title: "Inscrire votre agence — Green Trek" };

export default function InscriptionAgencePage() {
  return (
    <AuthLayout
      brand={{ kind: "plateforme" }}
      tabs={{
        active: "inscription",
        connexion: "/connexion",
        inscription: { href: "/inscription-agence", label: "Inscrire mon agence" },
      }}
      title="Lancez votre agence en ligne"
      subtitle="Créez votre espace et votre site vitrine. Période d'essai gratuite de 30 jours."
      showcase={platformShowcase()}
    >
      <RegisterAgencyForm />
    </AuthLayout>
  );
}
