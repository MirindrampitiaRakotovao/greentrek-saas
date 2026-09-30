import type { Metadata } from "next";

import { AgencySettingsForm } from "@/components/backoffice/agency-settings-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireAgencyUser } from "@/lib/auth/session";
import { getAgencySettings } from "@/lib/services/agency-settings";

export const metadata: Metadata = { title: "Paramètres de l'agence — Green Trek" };

/** Paramètres de l'agence : réservés à l'ADMIN_AGENCE (matrice §3). */
export default async function ParametresPage() {
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE"]);
  const settings = await getAgencySettings(db, user.agenceId);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Paramètres de l'agence" />
      <dl className="rounded-2xl border border-gt-mist bg-white p-6">
        <dt className="text-sm text-gt-teal-900/75">Adresse du site vitrine</dt>
        <dd className="mt-1 font-medium text-gt-teal-900">/a/{settings.slug}</dd>
        <dd className="mt-1 text-sm text-gt-teal-900/75">
          Non modifiable : la changer casserait les liens déjà partagés.
        </dd>
      </dl>
      <div className="rounded-2xl border border-gt-mist bg-white p-6">
        <AgencySettingsForm settings={settings} />
      </div>
    </div>
  );
}
