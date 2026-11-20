import type { Metadata } from "next";
import Link from "next/link";

import { ClientCreateForm } from "@/components/clients/client-create-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { EmptyState } from "@/components/dashboard/widgets";
import { Badge } from "@/components/ui/badge";
import { FormModal } from "@/components/ui/form-modal";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatDate, formatMoney } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { getAgencySettings } from "@/lib/services/agency-settings";
import { can } from "@/lib/permissions";
import { listClients } from "@/lib/services/clients";
import { ORIGINE_LABELS, ORIGINES, type Origine } from "@/lib/validators/clients";

export const metadata: Metadata = { title: "Clients — Green Trek" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Clients (voyageurs) de l'agence (§7.3) : inscrits en ligne, ou ajoutés par l'agence (après
 * E12), qui peut ensuite réserver pour eux depuis leur fiche.
 */
export default async function ClientsPage({ searchParams }: PageProps<"/dashboard/clients">) {
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  const params = await searchParams;
  const q = first(params.q)?.trim().slice(0, 100) || undefined;
  const page = parsePage(params.page);
  const origineParam = first(params.origine);
  const origine = ORIGINES.find((o) => o === origineParam) as Origine | undefined;
  const [clients, { devise }] = await Promise.all([
    listClients(db, q, page, origine),
    getAgencySettings(db, user.agenceId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description={`${clients.total} voyageur${clients.total > 1 ? "s" : ""} : inscrits en ligne ou ajoutés par l'agence.`}
        actions={
          can(user.role, "creer", "reservation") ? (
            <FormModal
              triggerLabel="Ajouter un client"
              title="Ajouter un client"
              description="Son compte voyageur est créé ; il reçoit un e-mail pour choisir son mot de passe. Vous pourrez ensuite réserver pour lui."
              icon="user"
            >
              <ClientCreateForm />
            </FormModal>
          ) : null
        }
      />
      <form method="get" className="flex max-w-2xl flex-wrap gap-2">
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
        <label htmlFor="origine-client" className="sr-only">
          Origine du client
        </label>
        <select
          id="origine-client"
          name="origine"
          defaultValue={origine ?? ""}
          className="rounded-full border border-gt-mist bg-white px-4 py-2 text-sm text-gt-teal-900"
        >
          <option value="">Toutes les origines</option>
          {ORIGINES.map((o) => (
            <option key={o} value={o}>
              {ORIGINE_LABELS[o]}
            </option>
          ))}
        </select>
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
          <table className="gt-table min-w-[880px]">
            <caption className="sr-only">Clients de l&apos;agence</caption>
            <thead>
              <tr>
                {[
                  "Client",
                  "Origine",
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
                  <td>
                    <Badge tone={c.origine === "AGENCE" ? "teal" : "neutral"}>
                      {ORIGINE_LABELS[c.origine]}
                    </Badge>
                    {c.actif ? null : (
                      <span className="ml-1">
                        <Badge tone="danger">Désactivé</Badge>
                      </span>
                    )}
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
        params={{ q, origine }}
      />
    </div>
  );
}
