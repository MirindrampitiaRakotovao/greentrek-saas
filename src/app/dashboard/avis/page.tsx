import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { EmptyState } from "@/components/dashboard/widgets";
import { ActionButton } from "@/components/reservations/action-button";
import { Stars } from "@/components/ui/stars";
import { publishAvisAction, rejectAvisAction } from "@/lib/actions/avis";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { listAvis } from "@/lib/services/avis";
import { avisFiltersSchema, STATUT_AVIS_LABELS } from "@/lib/validators/avis";

export const metadata: Metadata = { title: "Avis — Green Trek" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const FILTRES = ["EN_ATTENTE", "PUBLIE", "REJETE", ""] as const;

const STATUT_STYLES = {
  EN_ATTENTE: "bg-gt-sand-200 text-gt-teal-900",
  PUBLIE: "bg-emerald-100 text-emerald-900",
  REJETE: "bg-gt-mist text-gt-teal-900",
} as const;

/**
 * Modération des avis des voyageurs (§3 : ADMIN_AGENCE et STAFF). Seuls les avis publiés
 * apparaissent sur le site vitrine ; une décision peut être revue (publier un avis rejeté…).
 */
export default async function AvisPage({ searchParams }: PageProps<"/dashboard/avis">) {
  const { db } = await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  const params = await searchParams;
  // Par défaut : les avis à modérer, puisque c'est le travail à faire (« tous » : aucun filtre).
  const filters = avisFiltersSchema.parse({ statut: first(params.statut) ?? "EN_ATTENTE" });
  const page = parsePage(params.page);
  const avis = await listAvis(db, filters.statut, page);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avis des voyageurs"
        description="Les voyageurs notent leur séjour une fois terminé. Un avis n'apparaît sur votre site qu'après sa publication."
      />
      <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
        {FILTRES.map((s) => {
          const active = (filters.statut ?? "") === s;
          return (
            <Link
              key={s || "tous"}
              href={`/dashboard/avis?statut=${s || "tous"}`}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                active
                  ? "bg-gt-teal-700 text-white"
                  : "border border-gt-mist bg-white text-gt-teal-900 hover:bg-gt-teal-50"
              }`}
            >
              {s ? STATUT_AVIS_LABELS[s] : "Tous"}
            </Link>
          );
        })}
      </nav>

      {avis.total === 0 ? (
        <EmptyState>
          {filters.statut === "EN_ATTENTE" ? "Aucun avis à modérer." : "Aucun avis."}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {avis.items.map((a) => (
            <li
              key={a.id}
              className="flex flex-col rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gt-mist/60"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-gt-teal-900">
                    {a.client.prenom} {a.client.nom}
                  </p>
                  <p className="text-sm text-gt-teal-900/75">
                    {a.circuit.titre} ·{" "}
                    <Link
                      href={`/dashboard/reservations/${a.reservation.id}`}
                      className="font-mono text-xs font-semibold text-gt-teal-700 underline"
                    >
                      {a.reservation.reference}
                    </Link>
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${STATUT_STYLES[a.statut]}`}
                >
                  {STATUT_AVIS_LABELS[a.statut]}
                </span>
              </div>
              <div className="mt-3">
                <Stars note={a.note} />
              </div>
              <p className="mt-2 flex-1 text-sm whitespace-pre-line text-gt-teal-900/85">
                {a.commentaire ?? <em className="text-gt-teal-900/75">Sans commentaire.</em>}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-gt-teal-900/75">{formatDateTime(a.createdAt)}</p>
                <span className="flex gap-2">
                  {a.statut !== "PUBLIE" ? (
                    <ActionButton id={a.id} label="Publier" size="sm" action={publishAvisAction} />
                  ) : null}
                  {a.statut !== "REJETE" ? (
                    <ActionButton
                      id={a.id}
                      label="Rejeter"
                      size="sm"
                      variant="secondary"
                      action={rejectAvisAction}
                      confirmMessage="Rejeter cet avis ? Il ne sera pas affiché sur votre site."
                    />
                  ) : null}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        basePath="/dashboard/avis"
        page={avis.page}
        pageCount={avis.pageCount}
        params={{ statut: filters.statut ?? "tous" }}
      />
    </div>
  );
}
