import type { Metadata } from "next";
import Link from "next/link";

import { PartenaireForm } from "@/components/backoffice/partenaire-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireAgencyUser } from "@/lib/auth/session";
import { getAgencySettings } from "@/lib/services/agency-settings";

export const metadata: Metadata = { title: "Ajouter un partenaire — Green Trek" };

export default async function NouveauPartenairePage() {
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE"]);
  const { devise } = await getAgencySettings(db, user.agenceId);

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/dashboard/partenaires"
        className="text-sm font-medium text-gt-teal-700 underline"
      >
        ← Retour aux partenaires
      </Link>
      <PageHeader title="Ajouter un partenaire" />
      <div className="rounded-2xl border border-gt-mist bg-white p-6">
        <PartenaireForm devise={devise} />
      </div>
    </div>
  );
}
