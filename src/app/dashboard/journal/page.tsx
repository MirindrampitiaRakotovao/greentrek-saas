import type { Metadata } from "next";

import { JournalTable } from "@/components/dashboard/journal-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { EmptyState } from "@/components/dashboard/widgets";
import { requireAgencyUser } from "@/lib/auth/session";
import { parsePage } from "@/lib/pagination";
import { listJournal } from "@/lib/services/journal";

export const metadata: Metadata = { title: "Journal d'activité — Green Trek" };

/**
 * Journal d'activité de l'agence (§7.6, P2) : qui a fait quoi, et quand, pour les actions
 * sensibles (réservations, paiements, départs, équipe, paramètres). Réservé au responsable.
 */
export default async function JournalPage({ searchParams }: PageProps<"/dashboard/journal">) {
  const { db } = await requireAgencyUser(["ADMIN_AGENCE"]);
  const page = parsePage((await searchParams).page);
  const journal = await listJournal(db, page);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal d'activité"
        description="Les actions sensibles de votre équipe : réservations, paiements, départs, avis, comptes et paramètres."
      />
      {journal.total === 0 ? (
        <EmptyState>Aucune action enregistrée pour l&apos;instant.</EmptyState>
      ) : (
        <JournalTable items={journal.items} />
      )}
      <Pagination basePath="/dashboard/journal" page={journal.page} pageCount={journal.pageCount} />
    </div>
  );
}
