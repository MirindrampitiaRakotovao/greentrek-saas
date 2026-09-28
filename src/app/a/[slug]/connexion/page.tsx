import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getPublicAgency } from "@/lib/public-agency";

export async function generateMetadata({
  params,
}: PageProps<"/a/[slug]/connexion">): Promise<Metadata> {
  const agence = await getPublicAgency((await params).slug);
  return { title: agence ? `Connexion — ${agence.nom}` : "Agence introuvable" };
}

/** Connexion des clients d'une agence (uniquement les clients de CETTE agence). */
export default async function AgencyLoginPage({ params }: PageProps<"/a/[slug]/connexion">) {
  const { slug } = await params;
  const agence = await getPublicAgency(slug);
  if (!agence) notFound();

  return (
    <AuthCard title={`Connexion — ${agence.nom}`} subtitle="Accédez à vos réservations.">
      <LoginForm agenceSlug={agence.slug} />
    </AuthCard>
  );
}
