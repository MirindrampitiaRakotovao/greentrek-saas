import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { EmptyState } from "@/components/dashboard/widgets";
import { ActionButton } from "@/components/reservations/action-button";
import { rejectPaymentAction, validatePaymentAction } from "@/lib/actions/gestion-reservations";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatDateTime, formatMoney } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { getAgencySettings } from "@/lib/services/agency-settings";
import { listPaiements } from "@/lib/services/gestion-reservations";
import {
  METHODE_PAIEMENT_LABELS,
  METHODES_PAIEMENT,
  paiementFiltersSchema,
  STATUT_PAIEMENT_LABELS,
  STATUTS_PAIEMENT,
} from "@/lib/validators/reservations";

export const metadata: Metadata = { title: "Paiements — Green Trek" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const STATUT_STYLES = {
  EN_ATTENTE: "bg-gt-sand-200 text-gt-teal-900",
  VALIDE: "bg-emerald-100 text-emerald-900",
  ECHOUE: "bg-red-100 text-red-900",
  REMBOURSE: "bg-gt-mist text-gt-teal-900",
} as const;

/** Paiements (simulés) de l'agence : validation des virements et espèces en attente (§7.3). */
export default async function PaiementsPage({ searchParams }: PageProps<"/dashboard/paiements">) {
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  const params = await searchParams;
  const filters = paiementFiltersSchema.parse({
    statut: first(params.statut),
    methode: first(params.methode),
  });
  const page = parsePage(params.page);
  const [paiements, { devise }] = await Promise.all([
    listPaiements(db, filters, page),
    getAgencySettings(db, user.agenceId),
  ]);
  const field =
    "rounded-full border border-gt-mist bg-white px-3 py-2 text-sm text-gt-teal-900 outline-none focus:border-gt-teal-600 focus:ring-2 focus:ring-gt-teal-500/30";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paiements"
        description="Paiements simulés : aucune transaction réelle. Les virements et espèces sont à valider à réception."
      />
      <form method="get" className="flex flex-wrap items-center gap-2">
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
          {STATUTS_PAIEMENT.map((s) => (
            <option key={s} value={s}>
              {STATUT_PAIEMENT_LABELS[s]}
            </option>
          ))}
        </select>
        <label htmlFor="filtre-methode" className="sr-only">
          Moyen
        </label>
        <select
          id="filtre-methode"
          name="methode"
          defaultValue={filters.methode ?? ""}
          className={field}
        >
          <option value="">Tous les moyens</option>
          {METHODES_PAIEMENT.map((m) => (
            <option key={m} value={m}>
              {METHODE_PAIEMENT_LABELS[m]}
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

      {paiements.total === 0 ? (
        <EmptyState>Aucun paiement ne correspond.</EmptyState>
      ) : (
        <div className="relative overflow-x-auto rounded-2xl bg-white ring-1 ring-gt-mist/70">
          <table className="w-full min-w-[820px] text-left text-sm">
            <caption className="sr-only">Paiements</caption>
            <thead className="text-xs text-gt-teal-900/55">
              <tr className="border-b border-gt-mist/70">
                {["Réservation", "Client", "Moyen", "Montant", "Payé le", "Statut", ""].map(
                  (h, i) => (
                    <th key={`${h}-${i}`} scope="col" className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gt-mist/60">
              {paiements.items.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/reservations/${p.reservation.id}`}
                      className="font-mono text-xs font-semibold text-gt-teal-700 underline"
                    >
                      {p.reservation.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {p.reservation.client.prenom} {p.reservation.client.nom}
                  </td>
                  <td className="px-4 py-3">
                    {METHODE_PAIEMENT_LABELS[p.methode]}
                    {p.referenceExterne ? (
                      <span className="block text-xs text-gt-teal-900/60">
                        {p.referenceExterne}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatMoney(p.montant, devise)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(p.payeLe)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${STATUT_STYLES[p.statut]}`}
                    >
                      {STATUT_PAIEMENT_LABELS[p.statut]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.statut === "EN_ATTENTE" && p.reservation.statut !== "ANNULEE" ? (
                      <span className="flex gap-2">
                        <ActionButton
                          id={p.id}
                          label="Valider"
                          size="sm"
                          action={validatePaymentAction}
                        />
                        <ActionButton
                          id={p.id}
                          label="Refuser"
                          size="sm"
                          variant="secondary"
                          action={rejectPaymentAction}
                          confirmMessage="Refuser ce paiement (non reçu) ?"
                        />
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        basePath="/dashboard/paiements"
        page={paiements.page}
        pageCount={paiements.pageCount}
        params={{ statut: filters.statut, methode: filters.methode }}
      />
    </div>
  );
}
