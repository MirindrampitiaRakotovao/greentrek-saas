import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BlurBlobs } from "@/components/vitrine/blur-blobs";
import { BookingStepper } from "@/components/vitrine/booking-stepper";
import { BookingWizard } from "@/components/vitrine/booking-wizard";
import { CircuitVisual } from "@/components/vitrine/circuit-visual";
import { getCurrentUser, homePathFor } from "@/lib/auth/session";
import { formatDateRange, formatMoney } from "@/lib/format";
import { getBookableDepart } from "@/lib/services/vitrine";
import { loadVitrine } from "@/lib/vitrine-page";

export const metadata: Metadata = { title: "Réserver un départ" };

/**
 * Tunnel de réservation (§7.2), première partie : récapitulatif du départ puis, pour un client
 * connecté de l'agence, choix des voyageurs, participants et validation. Sans compte : liens
 * vers la connexion et l'inscription, qui ramènent ici ensuite. Un départ qui n'est plus
 * proposé au public (complet, annulé, commencé, circuit dépublié, autre agence) : page 404.
 */
export default async function ReserverPage({
  params,
}: PageProps<"/a/[slug]/reserver/[sessionId]">) {
  const { slug, sessionId } = await params;
  const { agence, db } = await loadVitrine(slug);
  const depart = await getBookableDepart(db, sessionId);
  if (!depart) notFound();

  const user = await getCurrentUser();
  // Personnel d'agence ou client d'une autre agence : on ne réserve pas avec ce compte.
  if (user && (user.role !== "CLIENT" || user.agenceSlug !== slug)) redirect(homePathFor(user));
  const client = user
    ? await db.utilisateur.findUnique({
        where: { id: user.id },
        select: { prenom: true, nom: true },
      })
    : null;
  const retour = encodeURIComponent(`/a/${slug}/reserver/${sessionId}`);

  return (
    <div className="relative isolate mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <BlurBlobs preset="corners" />
      <div className="min-w-0">
        <p className="text-sm font-semibold tracking-wide text-gt-teal-600 uppercase">
          Réservation
        </p>
        <h1 className="mt-1 mb-6 text-3xl font-medium text-gt-teal-900">{depart.circuit.titre}</h1>
        {client ? (
          <BookingWizard
            sessionId={depart.id}
            placesLibres={depart.placesLibres}
            prix={depart.prix}
            devise={agence.devise}
            client={client}
          />
        ) : (
          <div className="space-y-6">
            <BookingStepper current={0} />
            <div className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-gt-mist/60">
              <h2 className="text-xl font-medium text-gt-teal-900">Connectez-vous pour réserver</h2>
              <p className="mt-2 text-sm text-gt-teal-900/75">
                Un compte voyageur vous permet de suivre votre réservation, de la payer et de
                l&apos;annuler si besoin. Vous reviendrez directement ici.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/a/${slug}/connexion?retour=${retour}`}
                  className="rounded-full bg-gt-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gt-teal-800"
                >
                  Se connecter
                </Link>
                <Link
                  href={`/a/${slug}/inscription?retour=${retour}`}
                  className="rounded-full border border-gt-teal-700 px-5 py-2.5 text-sm font-semibold text-gt-teal-700 hover:bg-gt-teal-50"
                >
                  Créer un compte
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 shadow-gt-teal-900/10 ring-gt-mist/60">
          <div className="relative aspect-video">
            <CircuitVisual
              imageUrl={depart.circuit.imagePrincipaleUrl}
              landscapeKey={depart.circuit.slug}
              sizes="320px"
              className="size-full"
            />
          </div>
          <dl className="grid gap-3 p-5 text-sm">
            <div>
              <dt className="text-xs text-gt-teal-900/75">Dates</dt>
              <dd className="font-medium text-gt-teal-900">
                {formatDateRange(depart.dateDebut, depart.dateFin)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gt-teal-900/75">Prix</dt>
              <dd className="font-medium text-gt-teal-900">
                {formatMoney(depart.prix, agence.devise)} / pers.
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gt-teal-900/75">Places libres</dt>
              <dd className="font-medium text-gt-teal-900">{depart.placesLibres}</dd>
            </div>
          </dl>
          <Link
            href={`/a/${slug}/circuits/${depart.circuit.slug}`}
            className="block border-t border-gt-mist/60 px-5 py-3 text-sm font-medium text-gt-teal-700 underline"
          >
            ← Retour au circuit
          </Link>
        </div>
      </aside>
    </div>
  );
}
