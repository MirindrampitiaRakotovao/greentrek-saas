import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PartenaireForm } from "@/components/backoffice/partenaire-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { DeleteButton } from "@/components/ui/delete-button";
import { deletePartenaireAction } from "@/lib/actions/backoffice";
import { requireAgencyUser } from "@/lib/auth/session";
import { getAgencySettings } from "@/lib/services/agency-settings";
import { getPartenaire } from "@/lib/services/partenaires";

export const metadata: Metadata = { title: "Modifier un partenaire — Green Trek" };

export default async function PartenairePage({ params }: PageProps<"/dashboard/partenaires/[id]">) {
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE"]);
  const { id } = await params;
  // Client confiné : un partenaire d'une autre agence donne une page 404.
  const [partenaire, { devise }] = await Promise.all([
    getPartenaire(db, id),
    getAgencySettings(db, user.agenceId),
  ]);
  if (!partenaire) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/dashboard/partenaires"
        className="text-sm font-medium text-gt-teal-700 underline"
      >
        ← Retour aux partenaires
      </Link>
      <PageHeader
        title={partenaire.nom}
        description={`Inclus dans ${partenaire._count.circuits} circuit(s).`}
      />
      <div className="rounded-2xl border border-gt-mist bg-white p-6">
        <PartenaireForm partenaire={partenaire} devise={devise} />
      </div>
      <section className="rounded-2xl border border-red-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gt-teal-900">Supprimer</h2>
        <p className="mt-1 mb-4 text-sm text-gt-teal-900/70">
          Possible uniquement si le partenaire n&apos;est inclus dans aucun circuit. Sinon, décochez
          « Partenaire actif ».
        </p>
        <DeleteButton
          id={partenaire.id}
          label="Supprimer le partenaire"
          confirmMessage={`Supprimer définitivement « ${partenaire.nom} » ?`}
          action={deletePartenaireAction}
        />
      </section>
    </div>
  );
}
