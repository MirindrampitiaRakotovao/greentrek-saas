import type { Metadata } from "next";
import Link from "next/link";

import { GuideForm } from "@/components/backoffice/guide-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireAgencyUser } from "@/lib/auth/session";
import { listLinkableGuideAccounts } from "@/lib/services/guides";

export const metadata: Metadata = { title: "Ajouter un guide — Green Trek" };

export default async function NouveauGuidePage() {
  const { db } = await requireAgencyUser(["ADMIN_AGENCE"]);
  const accounts = await listLinkableGuideAccounts(db);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/dashboard/guides" className="text-sm font-medium text-gt-teal-700 underline">
        ← Retour aux guides
      </Link>
      <PageHeader
        title="Ajouter un guide"
        description="Pour donner un accès à la plateforme, créez d'abord un compte Guide dans « Équipe » : sa fiche est alors créée automatiquement."
      />
      <div className="rounded-2xl border border-gt-mist bg-white p-6">
        <GuideForm accounts={accounts} />
      </div>
    </div>
  );
}
