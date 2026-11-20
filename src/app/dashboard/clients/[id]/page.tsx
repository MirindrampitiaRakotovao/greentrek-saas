import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AgencyBookingForm } from "@/components/clients/agency-booking-form";
import { ClientEditForm } from "@/components/clients/client-edit-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, EmptyState, StatusPill } from "@/components/dashboard/widgets";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/ui/delete-button";
import { FormModal } from "@/components/ui/form-modal";
import { deleteClientAction } from "@/lib/actions/clients";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatDate, formatDateRange, formatDateTime, formatMoney } from "@/lib/format";
import { getAgencySettings } from "@/lib/services/agency-settings";
import { can } from "@/lib/permissions";
import { getClientDetail, listBookableDeparts } from "@/lib/services/clients";
import { listItinerairesAgence } from "@/lib/services/itineraires-perso";
import { ORIGINE_LABELS } from "@/lib/validators/clients";

export const metadata: Metadata = { title: "Client — Green Trek" };

/** Fiche d'un client avec l'historique de ses réservations (§7.3). Autre agence : 404. */
export default async function ClientPage({ params }: PageProps<"/dashboard/clients/[id]">) {
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  const { id } = await params;
  const peutReserver = can(user.role, "creer", "reservation");
  const peutModifier = can(user.role, "modifier", "reservation");
  const peutSupprimer = can(user.role, "supprimer", "utilisateur");
  const [client, { devise }, departs, itineraires] = await Promise.all([
    getClientDetail(db, id),
    getAgencySettings(db, user.agenceId),
    peutReserver ? listBookableDeparts(db) : Promise.resolve([]),
    listItinerairesAgence(db, { clientId: id }),
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
        description={`${client.origine === "AGENCE" ? "Ajouté par l'agence" : "Inscrit en ligne"} le ${formatDate(client.createdAt)} · dernière connexion : ${formatDateTime(client.dernierLoginAt, "jamais")}`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {peutModifier ? (
              <FormModal
                triggerLabel="Modifier"
                triggerIcon="pencil"
                variant="secondary"
                title={`Modifier ${client.prenom} ${client.nom}`}
                icon="pencil"
              >
                <ClientEditForm
                  client={{
                    id: client.id,
                    prenom: client.prenom,
                    nom: client.nom,
                    email: client.email,
                    telephone: client.telephone,
                    actif: client.actif,
                  }}
                />
              </FormModal>
            ) : null}
            {peutReserver && client.actif ? (
              <FormModal
                triggerLabel="Réserver pour ce client"
                title={`Réserver pour ${client.prenom} ${client.nom}`}
                description="Mêmes règles que sur le site (places, prix figé). Le client est prévenu et retrouve la réservation dans son espace et l'application."
                icon="calendar"
                size="lg"
              >
                <AgencyBookingForm
                  client={{ id: client.id, prenom: client.prenom, nom: client.nom }}
                  departs={departs.map((d) => ({
                    id: d.id,
                    label: `${d.circuit} · ${formatDateRange(d.dateDebut, d.dateFin)}`,
                    placesLibres: d.placesLibres,
                    prix: formatMoney(d.prix, devise),
                  }))}
                />
              </FormModal>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-5 md:grid-cols-3">
        <Card title="Contact">
          <div className="mb-2">
            <Badge tone={client.origine === "AGENCE" ? "teal" : "neutral"}>
              {ORIGINE_LABELS[client.origine]}
            </Badge>
          </div>
          <p className="text-sm text-gt-teal-900">{client.email}</p>
          <p className="text-sm text-gt-teal-900/75">
            {client.telephone ?? "Téléphone non renseigné"}
          </p>
        </Card>
        <Card title="Réservations">
          <p className="text-3xl font-semibold text-gt-teal-900">{client.reservations.length}</p>
          <p className="text-sm text-gt-teal-900/75">dont {actives.length} non annulée(s)</p>
        </Card>
        <Card title="Total réservé">
          <p className="text-3xl font-semibold text-gt-teal-900">{formatMoney(total, devise)}</p>
          <p className="text-sm text-gt-teal-900/75">hors réservations annulées</p>
        </Card>
      </div>
      <Card title={`Itinéraires sur mesure (${itineraires.total})`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gt-teal-900/75">
            Itinéraires entre des villages du réseau, proposés par l&apos;agence ou demandés par le
            client.
          </p>
          {peutReserver && client.actif ? (
            <Link
              href={`/dashboard/clients/${client.id}/itineraire`}
              className="flex items-center gap-2 rounded-full bg-gt-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-gt-teal-800"
            >
              Composer un itinéraire
            </Link>
          ) : null}
        </div>
        {itineraires.total === 0 ? (
          <EmptyState>Aucun itinéraire pour ce client.</EmptyState>
        ) : (
          <ul className="divide-y divide-gt-mist/60">
            {itineraires.items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-gt-teal-900">{it.titre}</p>
                  <p className="text-xs text-gt-teal-900/75">
                    {it.depart} → {it.arrivee} ·{" "}
                    {it.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km ·{" "}
                    {Math.floor(it.dureeMinutes / 60)} h{" "}
                    {String(it.dureeMinutes % 60).padStart(2, "0")} · {it.critere} ·{" "}
                    {it.origine === "AGENCE" ? `proposé par ${it.auteur}` : "demandé par le client"}{" "}
                    le {formatDateTime(it.createdAt)}
                  </p>
                  {it.reponse ? (
                    <p className="mt-1 text-xs text-gt-teal-900">« {it.reponse} »</p>
                  ) : null}
                </div>
                <Badge
                  tone={
                    it.statut === "ACCEPTE"
                      ? "success"
                      : it.statut === "DECLINE"
                        ? "danger"
                        : "sand"
                  }
                >
                  {it.statutLabel}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
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
                  <p className="text-xs text-gt-teal-900/75">
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
      {peutSupprimer ? (
        <Card title="Supprimer le client">
          {client.reservations.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-gt-teal-900/75">
                Le compte, ses conversations et ses itinéraires sur mesure seront supprimés
                définitivement.
              </p>
              <DeleteButton
                id={client.id}
                label="Supprimer ce client"
                confirmMessage={`Le compte de ${client.prenom} ${client.nom} sera supprimé définitivement, avec ses conversations et ses itinéraires sur mesure.`}
                action={deleteClientAction}
              />
            </div>
          ) : (
            <p className="text-sm text-gt-teal-900/75">
              Ce client a des réservations : il ne peut pas être supprimé, pour garder la trace des
              réservations, paiements et factures. Pour lui retirer l&apos;accès, désactivez son
              compte avec le bouton « Modifier ».
            </p>
          )}
        </Card>
      ) : null}
    </div>
  );
}
