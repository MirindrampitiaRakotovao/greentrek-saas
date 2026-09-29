import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { Card, EmptyState, StatusPill } from "@/components/dashboard/widgets";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatDate, formatDateRange, formatDateTime, formatMoney } from "@/lib/format";
import { getAgencySettings } from "@/lib/services/agency-settings";
import { getClientDetail } from "@/lib/services/clients";

export const metadata: Metadata = { title: "Client — Green Trek" };

/** Fiche d'un client avec l'historique de ses réservations (§7.3). Autre agence : 404. */
export default async function ClientPage({ params }: PageProps<"/dashboard/clients/[id]">) {
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  const { id } = await params;
  const [client, { devise }] = await Promise.all([
    getClientDetail(db, id),
    getAgencySettings(db, user.agenceId),
  ]);
  if (!client) notFound();
  const actives = client.reservations.filter((r) => r.statut !== "ANNULEE");
  const total = actives.reduce((t, r) => t + r.montantTotal, 0);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/clients" className="text-sm font-medium text-gt-teal-700 underline">
        ← Retour aux clients
      </Link>
      <PageHeader
        title={`${client.prenom} ${client.nom}`}
        description={`Inscrit le ${formatDate(client.createdAt)} · dernière connexion : ${formatDateTime(client.dernierLoginAt, "jamais")}`}
      />
      <div className="grid gap-5 md:grid-cols-3">
        <Card title="Contact">
          <p className="text-sm text-gt-teal-900">{client.email}</p>
          <p className="text-sm text-gt-teal-900/70">
            {client.telephone ?? "Téléphone non renseigné"}
          </p>
        </Card>
        <Card title="Réservations">
          <p className="text-3xl font-semibold text-gt-teal-900">{client.reservations.length}</p>
          <p className="text-sm text-gt-teal-900/70">dont {actives.length} non annulée(s)</p>
        </Card>
        <Card title="Total réservé">
          <p className="text-3xl font-semibold text-gt-teal-900">{formatMoney(total, devise)}</p>
          <p className="text-sm text-gt-teal-900/70">hors réservations annulées</p>
        </Card>
      </div>
      <Card title="Historique">
        {client.reservations.length === 0 ? (
          <EmptyState>Aucune réservation.</EmptyState>
        ) : (
          <ul className="divide-y divide-gt-mist/60">
            {client.reservations.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/reservations/${r.id}`}
                    className="font-mono text-xs font-semibold text-gt-teal-700 underline"
                  >
                    {r.reference}
                  </Link>
                  <p className="font-medium text-gt-teal-900">{r.session.circuit.titre}</p>
                  <p className="text-xs text-gt-teal-900/60">
                    {formatDateRange(r.session.dateDebut, r.session.dateFin)} · {r.nombrePersonnes}{" "}
                    pers. · réservée le {formatDateTime(r.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium whitespace-nowrap">
                    {formatMoney(r.montantTotal, devise)}
                  </span>
                  <StatusPill statut={r.statut} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
