import type { Metadata } from "next";
import Link from "next/link";

import { CircuitForm } from "@/components/circuits/circuit-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { EmptyState } from "@/components/dashboard/widgets";
import { FormModal } from "@/components/ui/form-modal";
import { Icon } from "@/components/ui/icon";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { getAgencySettings } from "@/lib/services/agency-settings";
import { listCircuits } from "@/lib/services/circuits";
import { DIFFICULTE_LABELS, STATUT_CIRCUIT_LABELS } from "@/lib/validators/circuits";

export const metadata: Metadata = { title: "Circuits — Green Trek" };

const STATUT_STYLES = {
  PUBLIE: "bg-gt-teal-100 text-gt-teal-800",
  BROUILLON: "bg-gt-sand-200 text-gt-teal-900",
  ARCHIVE: "bg-gt-mist text-gt-teal-900/70",
} as const;

/** Circuits de l'agence, en cartes (inspirées des cartes de la maquette du §8). */
export default async function CircuitsPage({ searchParams }: PageProps<"/dashboard/circuits">) {
  const { user, db } = await requireAgencyUser();
  const page = parsePage((await searchParams).page);
  const [circuits, { devise, slug }] = await Promise.all([
    listCircuits(db, page),
    getAgencySettings(db, user.agenceId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${circuits.total} circuit${circuits.total > 1 ? "s" : ""}`}
        description="Un circuit est publié sur le site vitrine dès qu'il compte au moins deux étapes."
        actions={
          can(user.role, "creer", "circuit") ? (
            <FormModal
              triggerLabel="Nouveau circuit"
              title="Nouveau circuit"
              description="Créé en brouillon : vous ajouterez ensuite ses étapes."
              icon="mountain"
            >
              <CircuitForm devise={devise} agenceSlug={slug} />
            </FormModal>
          ) : null
        }
      />

      {circuits.total === 0 ? (
        <EmptyState>Aucun circuit pour l&apos;instant.</EmptyState>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {circuits.items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/circuits/${c.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-3xl border border-gt-mist/70 bg-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gt-teal-900/10"
              >
                <div className="relative h-36 bg-gradient-to-br from-gt-teal-700 to-gt-teal-900">
                  {c.imagePrincipaleUrl ? (
                    // Adresse saisie par l'agence : image externe non optimisée par Next.js.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imagePrincipaleUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <Icon
                      name="mountain"
                      className="absolute right-5 bottom-4 size-16 text-white/15"
                    />
                  )}
                  <span
                    className={`absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUT_STYLES[c.statut]}`}
                  >
                    {STATUT_CIRCUIT_LABELS[c.statut]}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="font-semibold text-gt-teal-900 group-hover:underline">
                    {c.titre}
                  </h2>
                  {c.resume ? (
                    <p className="mt-1 line-clamp-2 text-sm text-gt-teal-900/65">{c.resume}</p>
                  ) : null}
                  <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gt-teal-900/70">
                    <span>{DIFFICULTE_LABELS[c.difficulte]}</span>
                    <span>
                      {c.dureeJours} jour{c.dureeJours > 1 ? "s" : ""}
                    </span>
                    <span>{c._count.etapes} étape(s)</span>
                    <span>{c._count.sessionsDepart} départ(s)</span>
                  </p>
                  <p className="mt-auto pt-4 text-sm text-gt-teal-900/70">
                    à partir de{" "}
                    <span className="text-lg font-bold text-gt-teal-900">
                      {formatMoney(c.prixParPersonne, devise)}
                    </span>{" "}
                    / pers.
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        basePath="/dashboard/circuits"
        page={circuits.page}
        pageCount={circuits.pageCount}
      />
    </div>
  );
}
