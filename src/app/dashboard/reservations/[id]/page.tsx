import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { Card, StatusPill } from "@/components/dashboard/widgets";
import { InvoicePanel } from "@/components/facture/invoice-panel";
import { ActionButton } from "@/components/reservations/action-button";
import { EncaissementForm } from "@/components/reservations/encaissement-form";
import { FormModal } from "@/components/ui/form-modal";
import {
  cancelReservationAgencyAction,
  confirmReservationAction,
  refundPaymentAction,
  rejectPaymentAction,
  validatePaymentAction,
} from "@/lib/actions/gestion-reservations";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatDateRange, formatDateTime, formatMoney } from "@/lib/format";
import { invoiceLink } from "@/lib/invoice-link";
import { can } from "@/lib/permissions";
import { getAgencySettings } from "@/lib/services/agency-settings";
import { getInvoice } from "@/lib/services/factures";
import { getReservation } from "@/lib/services/gestion-reservations";
import { METHODE_PAIEMENT_LABELS, STATUT_PAIEMENT_LABELS } from "@/lib/validators/reservations";

export const metadata: Metadata = { title: "Réservation — Green Trek" };

/**
 * Fiche d'une réservation (§7.3) : client, départ, participants, paiements, actions (confirmer,
 * annuler, encaisser, valider / refuser / rembourser un paiement) et facture avec QR code.
 * Réservation d'une autre agence : page 404 (client confiné).
 */
export default async function ReservationPage({
  params,
}: PageProps<"/dashboard/reservations/[id]">) {
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  const { id } = await params;
  const [reservation, settings] = await Promise.all([
    getReservation(db, id),
    getAgencySettings(db, user.agenceId),
  ]);
  if (!reservation) notFound();
  const [invoice, link] = await Promise.all([
    getInvoice(db, user.agenceId, id),
    invoiceLink(settings.slug, user.agenceId, id),
  ]);
  const devise = settings.devise;
  const r = reservation;
  const canPay = can(user.role, "modifier", "paiement");

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/reservations"
        className="text-sm font-medium text-gt-teal-700 underline"
      >
        ← Retour aux réservations
      </Link>
      <PageHeader
        title={`Réservation ${r.reference}`}
        description={`${r.session.circuit.titre} · ${formatDateRange(r.session.dateDebut, r.session.dateFin)} · ${r.nombrePersonnes} personne${r.nombrePersonnes > 1 ? "s" : ""}`}
        actions={<StatusPill statut={r.statut} />}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Montant" className="min-w-0">
          <p className="text-3xl font-semibold text-gt-teal-900">
            {formatMoney(r.montantTotal, devise)}
          </p>
          <p className="mt-1 text-sm text-gt-teal-900/70">
            Payé : {formatMoney(r.paye, devise)} · reste : {formatMoney(r.reste, devise)}
          </p>
          <p className="mt-3 text-xs text-gt-teal-900/60">
            Réservée le {formatDateTime(r.createdAt)}
            {r.confirmeeAt ? ` · confirmée le ${formatDateTime(r.confirmeeAt)}` : ""}
            {r.annuleeAt ? ` · annulée le ${formatDateTime(r.annuleeAt)}` : ""}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {r.peutConfirmer ? (
              <ActionButton
                id={r.id}
                label="Confirmer"
                pendingLabel="Confirmation…"
                action={confirmReservationAction}
                confirmMessage={
                  r.reste > 0
                    ? `Confirmer ${r.reference} alors qu'il reste ${formatMoney(r.reste, devise)} à payer ?`
                    : undefined
                }
              />
            ) : null}
            {r.peutAnnuler && can(user.role, "annuler", "reservation") ? (
              <ActionButton
                id={r.id}
                label="Annuler la réservation"
                pendingLabel="Annulation…"
                variant="danger"
                action={cancelReservationAgencyAction}
                confirmMessage={`Annuler ${r.reference} ? Les places seront libérées ; action définitive.`}
              />
            ) : null}
          </div>
        </Card>

        <Card title="Client" className="min-w-0">
          <Link
            href={`/dashboard/clients/${r.client.id}`}
            className="font-medium text-gt-teal-700 underline"
          >
            {r.client.prenom} {r.client.nom}
          </Link>
          <p className="text-sm text-gt-teal-900/70">{r.client.email}</p>
          {r.client.telephone ? (
            <p className="text-sm text-gt-teal-900/70">{r.client.telephone}</p>
          ) : null}
          {r.remarques ? (
            <p className="mt-3 rounded-xl bg-gt-teal-50 p-3 text-sm whitespace-pre-line text-gt-teal-900/80">
              {r.remarques}
            </p>
          ) : null}
        </Card>

        <Card title="Départ" className="min-w-0">
          <Link
            href={`/dashboard/departs/${r.session.id}`}
            className="font-medium text-gt-teal-700 underline"
          >
            {formatDateRange(r.session.dateDebut, r.session.dateFin)}
          </Link>
          <p className="text-sm text-gt-teal-900/70">{r.session.circuit.titre}</p>
          <p className="text-sm text-gt-teal-900/70">
            {r.session.guide
              ? `Guide : ${r.session.guide.prenom} ${r.session.guide.nom}`
              : "Sans guide"}
          </p>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title={`Participants (${r.participants.length})`} className="min-w-0">
          <ul className="divide-y divide-gt-mist/60 text-sm">
            {r.participants.map((p) => (
              <li key={p.id} className="py-2">
                <span className="font-medium text-gt-teal-900">
                  {p.prenom} {p.nom}
                </span>
                <span className="text-gt-teal-900/60">
                  {[
                    p.age !== null ? `${p.age} ans` : null,
                    p.nationalite,
                    p.contactUrgence ? `urgence : ${p.contactUrgence}` : null,
                  ]
                    .filter(Boolean)
                    .map((v) => ` · ${v}`)
                    .join("")}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Paiements" className="min-w-0">
          {r.paiements.length === 0 ? (
            <p className="text-sm text-gt-teal-900/70">Aucun paiement.</p>
          ) : (
            <ul className="divide-y divide-gt-mist/60 text-sm">
              {r.paiements.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span>
                    <span className="font-medium text-gt-teal-900">
                      {METHODE_PAIEMENT_LABELS[p.methode]}
                    </span>
                    <span className="block text-xs text-gt-teal-900/60">
                      {STATUT_PAIEMENT_LABELS[p.statut]}
                      {p.referenceExterne ? ` · ${p.referenceExterne}` : ""}
                      {p.payeLe ? ` · ${formatDateTime(p.payeLe)}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium whitespace-nowrap">
                      {formatMoney(p.montant, devise)}
                    </span>
                    {canPay && p.statut === "EN_ATTENTE" && r.statut !== "ANNULEE" ? (
                      <>
                        <ActionButton
                          id={p.id}
                          label="Valider"
                          size="sm"
                          action={validatePaymentAction}
                        />
                        <ActionButton
                          id={p.id}
                          label="Refuser"
                          size="sm"
                          variant="secondary"
                          action={rejectPaymentAction}
                          confirmMessage="Refuser ce paiement (non reçu) ?"
                        />
                      </>
                    ) : null}
                    {canPay && p.statut === "VALIDE" && r.statut === "ANNULEE" ? (
                      <ActionButton
                        id={p.id}
                        label="Rembourser"
                        size="sm"
                        variant="secondary"
                        action={refundPaymentAction}
                        confirmMessage={`Rembourser ${formatMoney(p.montant, devise)} (simulation) ?`}
                      />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canPay && r.peutEncaisser ? (
            <div className="mt-4 border-t border-gt-mist/60 pt-4">
              <FormModal
                triggerLabel="Enregistrer un paiement"
                triggerIcon="wallet"
                variant="secondary"
                title="Paiement reçu à l'agence"
                description={`${r.reference} · reste à payer : ${formatMoney(r.reste, devise)}`}
                icon="wallet"
              >
                <EncaissementForm reservationId={r.id} reste={r.reste} devise={devise} />
              </FormModal>
            </div>
          ) : null}
        </Card>
      </div>

      {invoice ? <InvoicePanel invoice={invoice} link={link} /> : null}
    </div>
  );
}
