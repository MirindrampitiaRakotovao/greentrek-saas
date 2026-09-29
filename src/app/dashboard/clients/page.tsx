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
        <div className="relative overflow-x-auto rounded-2xl bg-white ring-1 ring-gt-mist/70">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Clients de l&apos;agence</caption>
            <thead className="text-xs text-gt-teal-900/55">
              <tr className="border-b border-gt-mist/70">
                {[
                  "Client",
                  "Téléphone",
                  "Réservations",
                  "Total réservé",
                  "Dernière réservation",
                  "Inscrit le",
                ].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gt-mist/60">
              {clients.items.map((c) => (
                <tr key={c.id} className="hover:bg-gt-teal-50/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/clients/${c.id}`}
                      className="font-medium text-gt-teal-700 underline"
                    >
                      {c.prenom} {c.nom}
                    </Link>
                    <p className="text-xs text-gt-teal-900/60">{c.email}</p>
                  </td>
                  <td className="px-4 py-3">{c.telephone ?? "—"}</td>
                  <td className="px-4 py-3">{c.reservations}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatMoney(c.totalReserve, devise)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(c.derniereReservation)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(c.createdAt)}</td>
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
