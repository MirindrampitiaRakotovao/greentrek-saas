import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GuideForm } from "@/components/backoffice/guide-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { DeleteButton } from "@/components/ui/delete-button";
import { deleteGuideAction } from "@/lib/actions/backoffice";
import { requireAgencyUser } from "@/lib/auth/session";
import { getGuide, languageCodes, listLinkableGuideAccounts } from "@/lib/services/guides";

export const metadata: Metadata = { title: "Modifier un guide — Green Trek" };

export default async function GuidePage({ params }: PageProps<"/dashboard/guides/[id]">) {
  const { db } = await requireAgencyUser(["ADMIN_AGENCE"]);
  const { id } = await params;
  // Client confiné : une fiche d'une autre agence donne une page 404.
  const guide = await getGuide(db, id);
  if (!guide) notFound();
  const accounts = await listLinkableGuideAccounts(db, guide.utilisateurId);
  const fullName = `${guide.prenom} ${guide.nom}`;

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/dashboard/guides" className="text-sm font-medium text-gt-teal-700 underline">
        ← Retour aux guides
      </Link>
      <PageHeader
        title={fullName}
        description={`Encadre ${guide._count.sessionsDepart} départ(s).`}
      />
      <div className="rounded-2xl border border-gt-mist bg-white p-6">
        <GuideForm
          guide={{ ...guide, langues: languageCodes(guide.langues) }}
          accounts={accounts}
        />
      </div>
      <section className="rounded-2xl border border-red-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gt-teal-900">Supprimer</h2>
        <p className="mt-1 mb-4 text-sm text-gt-teal-900/70">
          Possible uniquement si la fiche n&apos;encadre aucun départ et n&apos;est reliée à aucun
          compte. Sinon, décochez « Guide actif ».
        </p>
        <DeleteButton
          id={guide.id}
          label="Supprimer la fiche"
          confirmMessage={`Supprimer définitivement la fiche de ${fullName} ?`}
          action={deleteGuideAction}
        />
      </section>
    </div>
  );
}
