import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, StatusPill } from "@/components/dashboard/widgets";
import { InvoicePanel } from "@/components/facture/invoice-panel";
import { Icon } from "@/components/ui/icon";
import { CancelReservationButton } from "@/components/vitrine/cancel-reservation-button";
import { requireClient } from "@/lib/auth/session";
import { formatDateRange, formatDateTime, formatMoney } from "@/lib/format";
import { invoiceLink } from "@/lib/invoice-link";
import { getVitrineAgency } from "@/lib/public-agency";
import { getInvoice } from "@/lib/services/factures";
import { getClientReservation } from "@/lib/services/reservations";
import { METHODE_PAIEMENT_LABELS, STATUT_PAIEMENT_LABELS } from "@/lib/validators/reservations";

export const metadata: Metadata = { title: "Ma réservation" };

/**
 * Fiche d'une réservation du client (§7.2) : confirmation avec la référence après le paiement
 * (`?paye=1`), participants, paiements, et actions possibles (payer, annuler selon RG 15).
 * Réservation d'un autre client : page 404.
 */
export default async function ReservationPage({
  params,
  searchParams,
}: PageProps<"/a/[slug]/mon-compte/reservations/[id]">) {
  const { slug, id } = await params;
  const { user, db } = await requireClient(slug, `/a/${slug}/mon-compte/reservations/${id}`);
  const [reservation, agence] = await Promise.all([
    getClientReservation(db, id, user.id),
    getVitrineAgency(slug),
  ]);
  if (!reservation) notFound();
  const devise = agence?.devise ?? "MGA";
  const [invoice, link] = await Promise.all([
    getInvoice(db, user.agenceId, reservation.id),
    invoiceLink(slug, user.agenceId, reservation.id),
  ]);
  const justPaid = (await searchParams).paye === "1";
  const paiementEnAttente = reservation.paiements.some((p) => p.statut === "EN_ATTENTE");

  return (
    <div className="space-y-5">
      <Link
        href={`/a/${slug}/mon-compte/reservations`}
        className="text-sm font-medium text-gt-teal-700 underline"
      >
        ← Mes réservations
      </Link>

      {justPaid ? (
        <div
          role="status"
          className="flex items-start gap-4 rounded-3xl bg-gt-teal-700 p-6 text-white shadow-lg"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/15">
            <Icon name="check" className="size-6" />
          </span>
          <div>
            <p className="text-xl font-medium">
              {reservation.statut === "CONFIRMEE"
                ? "Réservation confirmée !"
                : "Paiement enregistré, en attente de validation par l'agence."}
            </p>
            <p className="mt-1 text-white/85">
              Votre référence : <strong className="font-mono">{reservation.reference}</strong>.
              Conservez-la pour tout échange avec {agence?.nom ?? "l'agence"}.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-gt-teal-900/60">{reservation.reference}</p>
          <h2 className="text-2xl font-semibold text-gt-teal-900">
            {reservation.session.circuit.titre}
          </h2>
          <p className="text-sm text-gt-teal-900/70">
            {formatDateRange(reservation.session.dateDebut, reservation.session.dateFin)} · réservée
            le {formatDateTime(reservation.createdAt)}
          </p>
        </div>
        <StatusPill statut={reservation.statut} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Montant" className="min-w-0">
          <p className="text-3xl font-semibold text-gt-teal-900">
            {formatMoney(reservation.montantTotal, devise)}
          </p>
          <p className="mt-1 text-sm text-gt-teal-900/70">
            Payé : {formatMoney(reservation.paye, devise)} · reste :{" "}
            {formatMoney(reservation.reste, devise)}
          </p>
          {reservation.peutPayer ? (
            <Link
              href={`/a/${slug}/paiement/${reservation.id}`}
              className="mt-4 inline-block rounded-full bg-gt-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gt-teal-800"
            >
              Payer {formatMoney(reservation.reste, devise)}
            </Link>
          ) : null}
          {paiementEnAttente ? (
            <p className="mt-3 text-sm text-gt-teal-900/75">
              Un paiement est en attente de validation par l&apos;agence.
            </p>
          ) : null}
        </Card>

        <Card title={`Voyageurs (${reservation.nombrePersonnes})`} className="min-w-0">
          <ul className="space-y-1.5 text-sm text-gt-teal-900">
            {reservation.participants.map((p) => (
              <li key={p.id}>
                <span className="font-medium">
                  {p.prenom} {p.nom}
                </span>
                <span className="text-gt-teal-900/60">
                  {[p.age !== null ? `${p.age} ans` : null, p.nationalite]
                    .filter(Boolean)
                    .map((v) => ` · ${v}`)
                    .join("")}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Paiements" className="min-w-0">
          {reservation.paiements.length === 0 ? (
            <p className="text-sm text-gt-teal-900/70">Aucun paiement pour l&apos;instant.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {reservation.paiements.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2">
                  <span>
                    <span className="font-medium text-gt-teal-900">
                      {METHODE_PAIEMENT_LABELS[p.methode]}
                    </span>
                    <span className="block text-xs text-gt-teal-900/60">
                      {p.referenceExterne ?? "—"}
                      {p.payeLe ? ` · ${formatDateTime(p.payeLe)}` : ""}
                    </span>
                  </span>
                  <span className="text-right">
                    {formatMoney(p.montant, devise)}
                    <span className="block text-xs text-gt-teal-900/60">
                      {STATUT_PAIEMENT_LABELS[p.statut]}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {reservation.remarques ? (
        <Card title="Vos remarques">
          <p className="text-sm whitespace-pre-line text-gt-teal-900/80">{reservation.remarques}</p>
        </Card>
      ) : null}

      {invoice ? <InvoicePanel invoice={invoice} link={link} /> : null}

      {reservation.peutAnnuler ? (
        <Card title="Annulation">
          <p className="mb-3 text-sm text-gt-teal-900/70">
            Possible jusqu&apos;à la veille du départ (RG 15). Les paiements déjà validés sont
            remboursés par l&apos;agence.
          </p>
          <CancelReservationButton id={reservation.id} reference={reservation.reference} />
        </Card>
      ) : null}
    </div>
  );
}
