import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BlurBlobs } from "@/components/vitrine/blur-blobs";
import { BookingStepper } from "@/components/vitrine/booking-stepper";
import { PaymentForm } from "@/components/vitrine/payment-form";
import { requireClient } from "@/lib/auth/session";
import { formatDateRange, formatMoney } from "@/lib/format";
import { getClientReservation } from "@/lib/services/reservations";
import { loadVitrine } from "@/lib/vitrine-page";

export const metadata: Metadata = { title: "Paiement de la réservation" };

/**
 * Tunnel de réservation (§7.2), étape « paiement simulé ». Seul le client titulaire accède à
 * sa réservation (sinon 404). Réservation déjà payée, annulée ou paiement en attente : retour
 * à la fiche de la réservation dans l'espace client.
 */
export default async function PaiementPage({
  params,
}: PageProps<"/a/[slug]/paiement/[reservationId]">) {
  const { slug, reservationId } = await params;
  const { agence } = await loadVitrine(slug);
  const { user, db } = await requireClient(slug, `/a/${slug}/paiement/${reservationId}`);
  const reservation = await getClientReservation(db, reservationId, user.id);
  if (!reservation) notFound();
  if (!reservation.peutPayer) redirect(`/a/${slug}/mon-compte/reservations/${reservation.id}`);

  return (
    <div className="relative isolate mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <BlurBlobs preset="corners" />
      <BookingStepper current={3} />
      <div className="mt-8 rounded-3xl bg-white p-6 shadow-xl ring-1 shadow-gt-teal-900/10 ring-gt-mist/60 sm:p-8">
        <p className="text-sm font-semibold text-gt-teal-600">
          Réservation {reservation.reference} enregistrée
        </p>
        <h1 className="mt-1 text-2xl font-medium text-gt-teal-900">
          {reservation.session.circuit.titre}
        </h1>
        <p className="mt-1 text-sm text-gt-teal-900/70">
          {formatDateRange(reservation.session.dateDebut, reservation.session.dateFin)} ·{" "}
          {reservation.nombrePersonnes} voyageur{reservation.nombrePersonnes > 1 ? "s" : ""}
        </p>
        <dl className="mt-5 flex items-baseline justify-between rounded-2xl bg-gt-teal-50 px-4 py-3">
          <dt className="text-sm text-gt-teal-900/75">Montant à régler</dt>
          <dd className="text-2xl font-bold text-gt-teal-900">
            {formatMoney(reservation.reste, agence.devise)}
          </dd>
        </dl>
        <p className="mt-3 text-xs text-gt-teal-900/60">
          Vos places sont réservées. Vous pouvez aussi payer plus tard depuis « Mes réservations ».
        </p>
        <div className="mt-6">
          <PaymentForm
            reservationId={reservation.id}
            reste={reservation.reste}
            devise={agence.devise}
          />
        </div>
      </div>
    </div>
  );
}
