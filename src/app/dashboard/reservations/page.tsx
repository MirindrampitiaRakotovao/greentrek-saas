import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { EmptyState, StatusPill } from "@/components/dashboard/widgets";
import { Icon, type IconName } from "@/components/ui/icon";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatDateRange, formatMoney, formatShortDate } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { getAgencySettings } from "@/lib/services/agency-settings";
import { countATraiter, listReservations } from "@/lib/services/gestion-reservations";
import {
  reservationFiltersSchema,
  STATUT_RESERVATION_LABELS,
  STATUTS_RESERVATION,
} from "@/lib/validators/reservations";

export const metadata: Metadata = { title: "Réservations — Green Trek" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const PERIODES = { "a-venir": "À venir", passes: "Passées", tous: "Toutes" } as const;

/**
 * Réservations de l'agence (§7.3) : éléments à traiter, liste filtrable (période, statut,
 * circuit, recherche) avec filtres dans l'URL, export CSV des réservations filtrées.
 * ADMIN_AGENCE et STAFF ; le GUIDE voit ses participants depuis « Départs ».
 */
export default async function ReservationsPage({
  searchParams,
}: PageProps<"/dashboard/reservations">) {
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  const params = await searchParams;
  const filters = reservationFiltersSchema.parse({
    periode: first(params.periode),
    statut: first(params.statut),
    circuitId: first(params.circuit),
    q: first(params.q),
  });
  const page = parsePage(params.page);
  const [reservations, aTraiter, circuits, { devise }] = await Promise.all([
    listReservations(db, filters, page),
    countATraiter(db),
    db.circuit.findMany({ orderBy: { titre: "asc" }, select: { id: true, titre: true } }),
    getAgencySettings(db, user.agenceId),
  ]);

  const query = {
    periode: filters.periode,
    statut: filters.statut,
    circuit: filters.circuitId,
    q: filters.q,
  };
  const qs = (overrides: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...query, ...overrides })) if (v) search.set(k, v);
    return search.toString();
  };
  const tiles: { label: string; value: number; icon: IconName; href: string }[] = [
    {
      label: "Réservations en attente",
      value: aTraiter.enAttente,
      icon: "ticket",
      href: `/dashboard/reservations?${qs({ statut: "EN_ATTENTE", periode: "a-venir", page: undefined })}`,
    },
    {
      label: "Paiements à valider",
      value: aTraiter.paiementsAValider,
      icon: "wallet",
      href: "/dashboard/paiements?statut=EN_ATTENTE",
    },
    {
      label: "À régulariser (départ commencé)",
      value: aTraiter.aRegulariser,
      icon: "calendar",
      href: "/dashboard/reservations?statut=EN_ATTENTE&periode=tous",
    },
    {
      label: "À rembourser",
      value: aTraiter.aRembourser,
      icon: "coins",
      href: "/dashboard/reservations?statut=ANNULEE&periode=tous",
    },
  ];
  const field =
    "max-w-full min-w-0 rounded-full border border-gt-mist bg-white px-3 py-2 text-sm text-gt-teal-900 outline-none focus:border-gt-teal-600 focus:ring-2 focus:ring-gt-teal-500/30";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Réservations"
        description={`${reservations.total} réservation${reservations.total > 1 ? "s" : ""} pour ces critères`}
        actions={
          <a
            href={`/dashboard/reservations/export?${qs({})}`}
            className="flex items-center gap-2 rounded-full border border-gt-teal-700 px-4 py-2.5 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50"
          >
            <Icon name="download" className="size-4" />
            Exporter en CSV
          </a>
        }
      />

      <section aria-label="À traiter" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className={`flex items-center gap-3 rounded-2xl p-4 ring-1 transition hover:shadow-md ${
              t.value > 0 ? "bg-gt-sand-200/60 ring-gt-sand-300" : "bg-white ring-gt-mist/70"
            }`}
          >
            <span className="grid size-10 place-items-center rounded-xl bg-white text-gt-teal-700 ring-1 ring-gt-mist/60">
              <Icon name={t.icon} className="size-5" />
            </span>
            <span>
              <span className="block text-2xl font-semibold text-gt-teal-900">{t.value}</span>
              <span className="text-xs text-gt-teal-900/75">{t.label}</span>
            </span>
          </Link>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Période" className="flex gap-1 rounded-full bg-gt-teal-50 p-1">
          {(Object.keys(PERIODES) as (keyof typeof PERIODES)[]).map((p) => (
            <Link
              key={p}
              href={`/dashboard/reservations?${qs({ periode: p })}`}
              aria-current={filters.periode === p ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${filters.periode === p ? "bg-gt-teal-700 text-white" : "text-gt-teal-900 hover:bg-gt-teal-100"}`}
            >
              {PERIODES[p]}
            </Link>
          ))}
        </nav>
        {/* Formulaire GET : les filtres restent dans l'URL (partage, retour arrière, export). */}
        <form method="get" className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
          <input type="hidden" name="periode" value={filters.periode} />
          <label htmlFor="filtre-q" className="sr-only">
            Recherche
          </label>
          <input
            id="filtre-q"
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder="Référence, client…"
            className={field}
          />
          <label htmlFor="filtre-statut" className="sr-only">
            Statut
          </label>
          <select
            id="filtre-statut"
            name="statut"
            defaultValue={filters.statut ?? ""}
            className={field}
          >
            <option value="">Tous les statuts</option>
            {STATUTS_RESERVATION.map((s) => (
              <option key={s} value={s}>
                {STATUT_RESERVATION_LABELS[s]}
              </option>
            ))}
          </select>
          <label htmlFor="filtre-circuit" className="sr-only">
            Circuit
          </label>
          <select
            id="filtre-circuit"
            name="circuit"
            defaultValue={filters.circuitId ?? ""}
            className={field}
          >
            <option value="">Tous les circuits</option>
            {circuits.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titre}
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

      {reservations.total === 0 ? (
        <EmptyState>Aucune réservation ne correspond à ces critères.</EmptyState>
      ) : (
        <div className="gt-table-wrap">
          <table className="gt-table min-w-[760px]">
            <caption className="sr-only">Réservations</caption>
            <thead>
              <tr>
                {[
                  "Référence",
                  "Client",
                  "Circuit et départ",
                  "Pers.",
                  "Montant",
                  "Réservée le",
                  "Statut",
                ].map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reservations.items.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link
                      href={`/dashboard/reservations/${r.id}`}
                      className="font-mono text-xs font-semibold whitespace-nowrap text-gt-teal-700 underline"
                    >
                      {r.reference}
                    </Link>
                  </td>
                  <td>
                    <p className="font-medium text-gt-teal-900">
                      {r.client.prenom} {r.client.nom}
                    </p>
                    <p className="text-xs text-gt-teal-900/75">{r.client.email}</p>
                  </td>
                  <td>
                    <p
                      className="max-w-[200px] truncate text-gt-teal-900"
                      title={r.session.circuit.titre}
                    >
                      {r.session.circuit.titre}
                    </p>
                    <p className="text-xs text-gt-teal-900/75">
                      {formatDateRange(r.session.dateDebut, r.session.dateFin)}
                    </p>
                  </td>
                  <td>{r.nombrePersonnes}</td>
                  <td className="whitespace-nowrap">
                    <span className="font-medium">{formatMoney(r.montantTotal, devise)}</span>
                    <span className="block text-xs text-gt-teal-900/75">
                      {r.paye >= r.montantTotal ? "payé" : `payé ${formatMoney(r.paye, devise)}`}
                    </span>
                    {r.paiementsEnAttente > 0 ? (
                      <span className="block text-xs font-semibold text-gt-teal-700">
                        {r.paiementsEnAttente} à valider
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap text-gt-teal-900/75">
                    {formatShortDate(r.createdAt)}
                  </td>
                  <td>
                    <StatusPill statut={r.statut} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/dashboard/reservations"
        page={reservations.page}
        pageCount={reservations.pageCount}
        params={query}
      />
    </div>
  );
}
