import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { EmptyState } from "@/components/dashboard/widgets";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/session";
import { formatShortDate } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { STATUT_ABONNEMENT_LABELS } from "@/lib/plans";
import { listAgences } from "@/lib/services/plateforme";

export const metadata: Metadata = { title: "Agences — Console Green Trek" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Agences de la plateforme (§7.4) : statut, plan courant, volumes. SUPER_ADMIN uniquement. */
export default async function AgencesPage({ searchParams }: PageProps<"/admin/agences">) {
  await requireUser({ roles: ["SUPER_ADMIN"] });
  const params = await searchParams;
  const q = first(params.q)?.trim().slice(0, 100) || undefined;
  const agences = await listAgences(q, parsePage(params.page));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agences"
        description={`${agences.total} agence${agences.total > 1 ? "s" : ""} sur la plateforme`}
      />
      <form method="get" className="flex max-w-md gap-2">
        <label htmlFor="recherche-agence" className="sr-only">
          Rechercher une agence
        </label>
        <input
          id="recherche-agence"
          name="q"
          type="search"
          defaultValue={q ?? ""}
          placeholder="Nom ou identifiant"
          className="min-w-0 flex-1 rounded-full border border-gt-mist bg-white px-4 py-2 text-sm outline-none focus:border-gt-teal-600 focus:ring-2 focus:ring-gt-teal-500/30"
        />
        <button
          type="submit"
          className="rounded-full border border-gt-teal-700 px-4 py-2 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50"
        >
          Rechercher
        </button>
      </form>

      {agences.total === 0 ? (
        <EmptyState>Aucune agence ne correspond.</EmptyState>
      ) : (
        <div className="gt-table-wrap">
          <table className="gt-table min-w-[820px]">
            <caption className="sr-only">Agences</caption>
            <thead>
              <tr>
                {[
                  "Agence",
                  "Statut",
                  "Plan",
                  "Circuits",
                  "Personnel",
                  "Réservations",
                  "Inscrite le",
                ].map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agences.items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link
                      href={`/admin/agences/${a.id}`}
                      className="font-medium text-gt-teal-700 underline"
                    >
                      {a.nom}
                    </Link>
                    <p className="text-xs text-gt-teal-900/60">/a/{a.slug}</p>
                  </td>
                  <td>
                    <Badge tone={a.statut === "ACTIVE" ? "success" : "danger"}>
                      {a.statut === "ACTIVE" ? "Active" : "Suspendue"}
                    </Badge>
                  </td>
                  <td>
                    {a.abonnement ? (
                      <>
                        {a.abonnement.plan}
                        <span className="block text-xs text-gt-teal-900/60">
                          {STATUT_ABONNEMENT_LABELS[a.abonnement.statut]}
                        </span>
                      </>
                    ) : (
                      <span className="text-gt-teal-900/60">Sans abonnement</span>
                    )}
                  </td>
                  <td>{a._count.circuits}</td>
                  <td>{a._count.utilisateurs}</td>
                  <td>{a._count.reservations}</td>
                  <td className="whitespace-nowrap">{formatShortDate(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        basePath="/admin/agences"
        page={agences.page}
        pageCount={agences.pageCount}
        params={{ q }}
      />
    </div>
  );
}
