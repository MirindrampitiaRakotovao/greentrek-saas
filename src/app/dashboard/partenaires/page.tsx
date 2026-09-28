import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { Badge } from "@/components/ui/badge";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { can } from "@/lib/permissions";
import { getAgencySettings } from "@/lib/services/agency-settings";
import { listPartenaires } from "@/lib/services/partenaires";
import { TYPE_PARTENAIRE_LABELS } from "@/lib/validators/backoffice";

export const metadata: Metadata = { title: "Partenaires — Green Trek" };

/** Partenaires : ADMIN_AGENCE les gère, STAFF les consulte. */
export default async function PartenairesPage({
  searchParams,
}: PageProps<"/dashboard/partenaires">) {
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  const page = parsePage((await searchParams).page);
  const [partenaires, { devise }] = await Promise.all([
    listPartenaires(db, page),
    getAgencySettings(db, user.agenceId),
  ]);
  const canEdit = can(user.role, "modifier", "partenaire");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partenaires"
        description="Hébergements, restaurants, activités et transports associés à vos circuits."
        actions={
          can(user.role, "creer", "partenaire") ? (
            <Link
              href="/dashboard/partenaires/nouveau"
              className="rounded-full bg-gt-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-gt-teal-800"
            >
              Ajouter un partenaire
            </Link>
          ) : null
        }
      />

      {partenaires.total === 0 ? (
        <p className="rounded-2xl border border-dashed border-gt-mist bg-white p-8 text-center text-gt-teal-900/70">
          Aucun partenaire pour l&apos;instant.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gt-mist bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Partenaires de l&apos;agence</caption>
            <thead className="border-b border-gt-mist bg-gt-cream/50 text-gt-teal-900/80">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Nom
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Type
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Téléphone
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Tarif indicatif
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Circuits
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Statut
                </th>
                {canEdit ? (
                  <th scope="col" className="px-4 py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-gt-mist">
              {partenaires.items.map((partenaire) => (
                <tr key={partenaire.id} className={partenaire.actif ? "" : "text-gt-teal-900/60"}>
                  <td className="px-4 py-3 font-medium text-gt-teal-900">{partenaire.nom}</td>
                  <td className="px-4 py-3">{TYPE_PARTENAIRE_LABELS[partenaire.type]}</td>
                  <td className="px-4 py-3">{partenaire.telephone ?? "—"}</td>
                  <td className="px-4 py-3">{formatMoney(partenaire.tarifIndicatif, devise)}</td>
                  <td className="px-4 py-3">{partenaire._count.circuits}</td>
                  <td className="px-4 py-3">
                    <Badge tone={partenaire.actif ? "success" : "danger"}>
                      {partenaire.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </td>
                  {canEdit ? (
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/partenaires/${partenaire.id}`}
                        className="font-medium text-gt-teal-700 underline hover:text-gt-teal-900"
                      >
                        Modifier
                      </Link>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/dashboard/partenaires"
        page={partenaires.page}
        pageCount={partenaires.pageCount}
      />
    </div>
  );
}
