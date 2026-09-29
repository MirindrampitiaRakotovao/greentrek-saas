import type { Metadata } from "next";
import Link from "next/link";

import { DepartForm } from "@/components/departs/depart-form";
import { DepartList } from "@/components/departs/depart-list";
import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { EmptyState } from "@/components/dashboard/widgets";
import { FormModal } from "@/components/ui/form-modal";
import { requireAgencyUser } from "@/lib/auth/session";
import { parsePage } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { getAgencySettings } from "@/lib/services/agency-settings";
import { departFormOptions, findGuideFiche, listDeparts } from "@/lib/services/departs";
import {
  departFiltersSchema,
  type Periode,
  STATUT_SESSION_LABELS,
  STATUTS_SESSION,
} from "@/lib/validators/departs";

export const metadata: Metadata = { title: "Départs — Green Trek" };

const PERIODE_LABELS: Record<Periode, string> = {
  "a-venir": "À venir",
  passes: "Passés",
  tous: "Tous",
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Départs de l'agence, groupés par mois, avec filtres (période, circuit, statut) dans l'URL.
 * Un GUIDE ne voit que les départs qu'il encadre (matrice §3).
 */
export default async function DepartsPage({ searchParams }: PageProps<"/dashboard/departs">) {
  const { user, db } = await requireAgencyUser();
  const params = await searchParams;
  const filters = departFiltersSchema.parse({
    periode: first(params.periode),
    circuitId: first(params.circuit),
    statut: first(params.statut),
  });
  const page = parsePage(params.page);

  const isGuide = user.role === "GUIDE";
  const fiche = isGuide ? await findGuideFiche(db, user.id) : null;
  if (isGuide && !fiche) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mes départs" />
        <EmptyState>
          Votre compte n&apos;est relié à aucune fiche guide : demandez à l&apos;administrateur de
          l&apos;agence de la relier.
        </EmptyState>
      </div>
    );
  }

  const [departs, circuits, { devise }, options] = await Promise.all([
    listDeparts(db, { ...filters, guideId: fiche?.id }, page),
    db.circuit.findMany({ orderBy: { titre: "asc" }, select: { id: true, titre: true } }),
    getAgencySettings(db, user.agenceId),
    departFormOptions(db),
  ]);

  const query = {
    periode: filters.periode,
    circuit: filters.circuitId,
    statut: filters.statut,
  };
  const hrefWith = (periode: Periode) => {
    const search = new URLSearchParams({ periode });
    if (filters.circuitId) search.set("circuit", filters.circuitId);
    if (filters.statut) search.set("statut", filters.statut);
    return `/dashboard/departs?${search.toString()}`;
  };
  const selectClass =
    "max-w-full min-w-0 rounded-full border border-gt-mist bg-white px-3 py-2 text-sm text-gt-teal-900 outline-none focus:border-gt-teal-600 focus:ring-2 focus:ring-gt-teal-500/30";

  return (
    <div className="space-y-6">
      <PageHeader
        title={isGuide ? "Mes départs" : "Départs"}
        description={`${departs.total} départ${departs.total > 1 ? "s" : ""} · le statut passe à « Complet » dès que toutes les places sont réservées (RG 11).`}
        actions={
          can(user.role, "creer", "sessionDepart") ? (
            <FormModal
              triggerLabel="Programmer un départ"
              title="Programmer un départ"
              description="Un départ ouvre les réservations d'un circuit à des dates données."
              icon="calendar"
            >
              <DepartForm
                circuits={options.circuits}
                guides={options.guides}
                devise={devise}
                today={options.today}
                defaultCircuitId={filters.circuitId}
              />
            </FormModal>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Période" className="flex gap-1 rounded-full bg-gt-teal-50 p-1">
          {(Object.keys(PERIODE_LABELS) as Periode[]).map((periode) => (
            <Link
              key={periode}
              href={hrefWith(periode)}
              aria-current={filters.periode === periode ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${filters.periode === periode ? "bg-gt-teal-700 text-white" : "text-gt-teal-900 hover:bg-gt-teal-100"}`}
            >
              {PERIODE_LABELS[periode]}
            </Link>
          ))}
        </nav>
        {/* Formulaire GET : les filtres restent dans l'URL (partage, retour arrière). */}
        <form method="get" className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
          <input type="hidden" name="periode" value={filters.periode} />
          {isGuide ? null : (
            <>
              <label htmlFor="filtre-circuit" className="sr-only">
                Circuit
              </label>
              <select
                id="filtre-circuit"
                name="circuit"
                defaultValue={filters.circuitId ?? ""}
                className={selectClass}
              >
                <option value="">Tous les circuits</option>
                {circuits.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titre}
                  </option>
                ))}
              </select>
            </>
          )}
          <label htmlFor="filtre-statut" className="sr-only">
            Statut
          </label>
          <select
            id="filtre-statut"
            name="statut"
            defaultValue={filters.statut ?? ""}
            className={selectClass}
          >
            <option value="">Tous les statuts</option>
            {STATUTS_SESSION.map((s) => (
              <option key={s} value={s}>
                {STATUT_SESSION_LABELS[s]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-full border border-gt-teal-700 px-4 py-2 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50"
          >
            Filtrer
          </button>
        </form>
      </div>

      {departs.total === 0 ? (
        <EmptyState>Aucun départ ne correspond à ces critères.</EmptyState>
      ) : (
        <DepartList departs={departs.items} devise={devise} />
      )}

      <Pagination
        basePath="/dashboard/departs"
        page={departs.page}
        pageCount={departs.pageCount}
        params={query}
      />
    </div>
  );
}
