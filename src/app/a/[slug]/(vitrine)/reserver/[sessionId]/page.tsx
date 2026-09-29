import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDateRange, formatMoney } from "@/lib/format";
import { getBookableDepart } from "@/lib/services/vitrine";
import { loadVitrine } from "@/lib/vitrine-page";

export const metadata: Metadata = { title: "Réserver un départ" };

/**
 * Page d'attente de la réservation (décision D de l'étape E8) : récapitulatif du départ
 * choisi. Le tunnel de réservation (compte, participants, paiement simulé) est l'étape E9.
 * Un départ qui n'est plus proposé au public (complet, annulé, commencé, circuit dépublié,
 * autre agence) donne une page 404.
 */
export default async function ReserverPage({
  params,
}: PageProps<"/a/[slug]/reserver/[sessionId]">) {
  const { slug, sessionId } = await params;
  const { agence, db } = await loadVitrine(slug);
  const depart = await getBookableDepart(db, sessionId);
  if (!depart) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <p className="font-script text-3xl text-gt-teal-700">Réserver</p>
      <h1 className="mt-2 text-2xl font-semibold text-gt-teal-900">{depart.circuit.titre}</h1>
      <dl className="mt-6 grid gap-4 rounded-3xl border border-gt-mist/70 p-6 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-gt-teal-900/60">Dates</dt>
          <dd className="font-medium text-gt-teal-900">
            {formatDateRange(depart.dateDebut, depart.dateFin)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gt-teal-900/60">Places libres</dt>
          <dd className="font-medium text-gt-teal-900">{depart.placesLibres}</dd>
        </div>
        <div>
          <dt className="text-xs text-gt-teal-900/60">Prix</dt>
          <dd className="font-medium text-gt-teal-900">
            {formatMoney(depart.prix, agence.devise)} / pers.
          </dd>
        </div>
      </dl>
      <p className="mt-6 rounded-2xl bg-gt-sand-200/60 px-5 py-4 text-sm text-gt-teal-900">
        La réservation en ligne sera bientôt disponible. En attendant, contactez l&apos;agence pour
        réserver ce départ.
      </p>
      <Link
        href={`/a/${agence.slug}/circuits/${depart.circuit.slug}`}
        className="mt-6 inline-block text-sm font-medium text-gt-teal-700 underline"
      >
        ← Retour au circuit
      </Link>
    </div>
  );
}
