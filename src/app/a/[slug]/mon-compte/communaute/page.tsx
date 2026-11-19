import type { Metadata } from "next";

import { PublicationCard } from "@/components/communaute/publication-card";
import { PublicationForm } from "@/components/communaute/publication-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { EmptyState } from "@/components/dashboard/widgets";
import { FormModal } from "@/components/ui/form-modal";
import { requireClient } from "@/lib/auth/session";
import { formatDateRange } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { listFeed, listSejoursPartageables } from "@/lib/services/communaute";

export const metadata: Metadata = { title: "Communauté" };

/**
 * Fil de la communauté (étape 5d) : les photos de séjour des voyageurs de toutes les agences
 * de la plateforme. On publie après un séjour terminé.
 */
export default async function CommunautePage({
  params,
  searchParams,
}: PageProps<"/a/[slug]/mon-compte/communaute">) {
  const { slug } = await params;
  const { user } = await requireClient(slug, `/a/${slug}/mon-compte/communaute`);
  const basePath = `/a/${slug}/mon-compte/communaute`;
  const [feed, sejours] = await Promise.all([
    listFeed(user.id, parsePage((await searchParams).page)),
    listSejoursPartageables(user.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Communauté"
        description="Les photos de séjour des voyageurs de toutes les agences de la plateforme."
        actions={
          sejours.length ? (
            <FormModal
              triggerLabel="Partager mes photos"
              triggerIcon="image"
              title="Partager les photos d'un séjour"
              icon="image"
            >
              <PublicationForm
                sejours={sejours.map((s) => ({
                  id: s.id,
                  label: `${s.circuit} · ${formatDateRange(s.dateDebut, s.dateFin)}`,
                }))}
              />
            </FormModal>
          ) : undefined
        }
      />
      {sejours.length === 0 ? (
        <p className="rounded-2xl bg-gt-teal-50 p-4 text-sm text-gt-teal-900">
          Vous pourrez partager vos photos ici une fois votre premier séjour terminé.
        </p>
      ) : null}
      {feed.total === 0 ? (
        <EmptyState>Aucune publication pour l&apos;instant.</EmptyState>
      ) : (
        <div className="space-y-5">
          {feed.items.map((p) => (
            <PublicationCard key={p.id} p={p} basePath={basePath} />
          ))}
        </div>
      )}
      <Pagination basePath={basePath} page={feed.page} pageCount={feed.pageCount} />
    </div>
  );
}
