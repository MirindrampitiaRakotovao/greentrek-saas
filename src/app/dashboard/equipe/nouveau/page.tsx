import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { MemberCreateForm } from "@/components/team/member-create-form";
import { requireAgencyUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Ajouter un membre — Green Trek" };

export default async function NouveauMembrePage() {
  // Seul l'ADMIN_AGENCE crée des comptes (matrice §3) ; les autres sont renvoyés à leur accueil.
  await requireAgencyUser(["ADMIN_AGENCE"]);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/dashboard/equipe" className="text-sm font-medium text-gt-teal-700 underline">
        ← Retour à l&apos;équipe
      </Link>
      <PageHeader
        title="Ajouter un membre"
        description="Un compte Guide reçoit automatiquement sa fiche guide."
      />
      <div className="rounded-2xl border border-gt-mist bg-white p-6">
        <MemberCreateForm />
      </div>
    </div>
  );
}
