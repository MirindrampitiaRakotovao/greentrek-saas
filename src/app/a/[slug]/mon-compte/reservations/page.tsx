import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState, StatusPill } from "@/components/dashboard/widgets";
import { CircuitVisual } from "@/components/vitrine/circuit-visual";
import { requireClient } from "@/lib/auth/session";
import { formatDateRange, formatMoney } from "@/lib/format";
import { getVitrineAgency } from "@/lib/public-agency";
import { listClientReservations } from "@/lib/services/reservations";

export const metadata: Metadata = { title: "Mes réservations" };

/** « Mes réservations » (§7.2) : uniquement celles du client connecté, les plus récentes d'abord. */
export default async function MesReservationsPage({
  params,
}: PageProps<"/a/[slug]/mon-compte/reservations">) {
  const { slug } = await params;
  const { user, db } = await requireClient(slug, `/a/${slug}/mon-compte/reservations`);
  const [reservations, agence] = await Promise.all([
    listClientReservations(db, user.id),
    getVitrineAgency(slug),
  ]);
  const devise = agence?.devise ?? "MGA";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes réservations"
        description={`${reservations.length} réservation${reservations.length > 1 ? "s" : ""}`}
        actions={
          <Link
            href={`/a/${slug}/circuits`}
            className="rounded-full bg-gt-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-gt-teal-800"
          >
            Réserver un circuit
          </Link>
        }
      />
      {reservations.length === 0 ? (
        <EmptyState>Vous n&apos;avez pas encore de réservation.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {reservations.map((r) => (
            <li key={r.id}>
              <Link
                href={`/a/${slug}/mon-compte/reservations/${r.id}`}
                className="group flex gap-4 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-gt-mist/60 transition hover:shadow-md"
              >
                <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl">
                  <CircuitVisual
                    imageUrl={r.session.circuit.imagePrincipaleUrl}
                    landscapeKey={r.session.circuit.slug}
                    sizes="96px"
                    className="size-full"
                  />
                </div>
                <div className="min-w-0 flex-1 py-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-xs text-gt-teal-900/60">{r.reference}</p>
                    <StatusPill statut={r.statut} />
                  </div>
                  <p className="mt-1 line-clamp-1 font-medium text-gt-teal-900 group-hover:underline">
                    {r.session.circuit.titre}
                  </p>
                  <p className="text-sm text-gt-teal-900/70">
                    {formatDateRange(r.session.dateDebut, r.session.dateFin)} · {r.nombrePersonnes}{" "}
                    pers.
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-semibold text-gt-teal-900">
                      {formatMoney(r.montantTotal, devise)}
                    </span>
                    {r.peutPayer ? (
                      <span className="ml-2 text-xs font-semibold text-gt-teal-700">
                        À payer : {formatMoney(r.reste, devise)}
                      </span>
                    ) : null}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
