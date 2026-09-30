import type { Metadata } from "next";

import { JournalTable } from "@/components/dashboard/journal-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { EmptyState } from "@/components/dashboard/widgets";
import { getAdminDb } from "@/lib/admin-db";
import { requireUser } from "@/lib/auth/session";
import { parsePage } from "@/lib/pagination";
import { listJournal } from "@/lib/services/journal";

export const metadata: Metadata = { title: "Journal d'activité — Console plateforme" };

/**
 * Journal des actions de la plateforme (suspensions, plans attribués, plans modifiés). Les
 * actions internes des agences restent dans le journal de chaque agence.
 */
export default async function AdminJournalPage({ searchParams }: PageProps<"/admin/journal">) {
  await requireUser({ roles: ["SUPER_ADMIN"] });
  const page = parsePage((await searchParams).page);
  const journal = await listJournal(getAdminDb(), page, {
    utilisateur: { role: "SUPER_ADMIN" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal d'activité"
        description="Actions de la console : suspensions et réactivations d'agences, attributions et modifications de plans."
      />
      {journal.total === 0 ? (
        <EmptyState>Aucune action enregistrée pour l&apos;instant.</EmptyState>
      ) : (
        <JournalTable items={journal.items} showAgency />
      )}
      <Pagination basePath="/admin/journal" page={journal.page} pageCount={journal.pageCount} />
    </div>
  );
}
