import type { Metadata } from "next";
import Link from "next/link";

import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";
import { FormSuccess } from "@/components/ui/form-success";
import { platformShowcase } from "@/lib/auth/showcase";

export const metadata: Metadata = { title: "Connexion — Green Trek" };

/** Connexion du personnel des agences et du super admin (les clients passent par /a/[slug]). */
export default async function ConnexionPage({ searchParams }: PageProps<"/connexion">) {
  const reinitialise = (await searchParams).reinitialise === "1";
  return (
    <AuthLayout
      brand={{ kind: "plateforme" }}
      tabs={{
        active: "connexion",
        connexion: "/connexion",
        inscription: { href: "/inscription-agence", label: "Inscrire mon agence" },
      }}
      title="Bon retour parmi nous"
      subtitle="Espace des agences (administrateurs, personnel, guides) et administration de la plateforme."
      notice={
        reinitialise ? (
          <FormSuccess message="Mot de passe modifié : connectez-vous avec votre nouveau mot de passe." />
        ) : null
      }
      footer={
        <>
          Vous êtes voyageur ? Connectez-vous depuis le site de votre agence, accessible depuis{" "}
          <Link href="/#agences" className="font-medium text-gt-teal-700 underline">
            la liste des agences
          </Link>
          .
        </>
      }
      showcase={platformShowcase()}
    >
      <LoginForm />
    </AuthLayout>
  );
}
