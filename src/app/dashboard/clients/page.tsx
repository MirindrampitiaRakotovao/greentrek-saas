import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { EmptyState } from "@/components/dashboard/widgets";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatDate, formatMoney } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { getAgencySettings } from "@/lib/services/agency-settings";
import { listClients } from "@/lib/services/clients";

export const metadata: Metadata = { title: "Clients — Green Trek" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Clients (voyageurs) de l'agence (§7.3), en lecture seule (décision E de l'étape E10). */
export default async function ClientsPage({ searchParams }: PageProps<"/dashboard/clients">) {
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  const params = await searchParams;
  const q = first(params.q)?.trim().slice(0, 100) || undefined;
  const page = parsePage(params.page);
  const [clients, { devise }] = await Promise.all([
    listClients(db, q, page),
    getAgencySettings(db, user.agenceId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description={`${clients.total} voyageur${clients.total > 1 ? "s" : ""} inscrit${clients.total > 1 ? "s" : ""} sur le site de l'agence`}
      />
      <form method="get" className="flex max-w-md gap-2">
        <label htmlFor="recherche-client" className="sr-only">
          Rechercher un client
        </label>
        <input
          id="recherche-client"
          name="q"
          type="search"
          defaultValue={q ?? ""}
          placeholder="Nom, prénom ou e-mail"
          className="min-w-0 flex-1 rounded-full border border-gt-mist bg-white px-4 py-2 text-sm outline-none focus:border-gt-teal-600 focus:ring-2 focus:ring-gt-teal-500/30"
        />
        <button
          type="submit"
          className="rounded-full border border-gt-teal-700 px-4 py-2 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50"
        >
          Rechercher
        </button>
      </form>

      {clients.total === 0 ? (
        <EmptyState>Aucun client ne correspond.</EmptyState>
      ) : (
        <div className="gt-table-wrap">
          <table className="gt-table min-w-[760px]">
            <caption className="sr-only">Clients de l&apos;agence</caption>
            <thead>
              <tr>
                {[
                  "Client",
                  "Téléphone",
                  "Réservations",
                  "Total réservé",
                  "Dernière réservation",
                  "Inscrit le",
                ].map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link
                      href={`/dashboard/clients/${c.id}`}
                      className="font-medium text-gt-teal-700 underline"
                    >
                      {c.prenom} {c.nom}
                    </Link>
                    <p className="text-xs text-gt-teal-900/75">{c.email}</p>
                  </td>
                  <td>{c.telephone ?? "—"}</td>
                  <td>{c.reservations}</td>
                  <td className="whitespace-nowrap">{formatMoney(c.totalReserve, devise)}</td>
                  <td className="whitespace-nowrap">{formatDate(c.derniereReservation)}</td>
                  <td className="whitespace-nowrap">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        basePath="/dashboard/clients"
        page={clients.page}
        pageCount={clients.pageCount}
        params={{ q }}
      />
    </div>
  );
}
