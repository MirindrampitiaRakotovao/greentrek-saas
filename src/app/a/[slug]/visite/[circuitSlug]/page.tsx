import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GameTourEntry } from "@/components/visit/game/game-tour-entry";
import { VirtualTourEntry } from "@/components/visit/virtual-tour-entry";
import { getCurrentUser } from "@/lib/auth/session";
import { getVitrineAgency } from "@/lib/public-agency";
import { visitParty, visitWaypoints } from "@/lib/services/visite";
import { getPublicCircuit } from "@/lib/services/vitrine";
import { getTenantDb } from "@/lib/tenant";
import { TYPE_ETAPE_LABELS } from "@/lib/validators/circuits";
import { loadVitrine } from "@/lib/vitrine-page";

type Props = PageProps<"/a/[slug]/visite/[circuitSlug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, circuitSlug } = await params;
  const agence = await getVitrineAgency(slug);
  const circuit = agence ? await getPublicCircuit(getTenantDb(agence.id), circuitSlug) : null;
  return {
    title:
      circuit && agence
        ? `Visite virtuelle · ${circuit.titre} — ${agence.nom}`
        : "Visite virtuelle",
  };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Visite virtuelle d'un circuit : page publique en plein écran, ouverte depuis la fiche du
 * circuit ou depuis l'espace voyageur (réservations). Circuit publié seulement (RG 9) ; même
 * agence que l'adresse (client confiné).
 * - « Mode jeu » par défaut (étape 8b) : monde 3D, groupe de la réservation, pirogue, sons ;
 * - « Mode léger » (`?mode=carte`, étape 8a) : balade sur la carte satellite 3D, aussi
 *   utilisée si le navigateur ne sait pas afficher le mode jeu.
 */
export default async function VisitePage({ params, searchParams }: Props) {
  const { slug, circuitSlug } = await params;
  const query = await searchParams;
  const { agence, db } = await loadVitrine(slug);
  const circuit = await getPublicCircuit(db, circuitSlug);
  if (!circuit || circuit.etapes.length < 2) notFound();

  // Retour : vers l'espace voyageur de CETTE agence s'il est demandé (adresse vérifiée :
  // jamais de redirection vers un autre site), sinon vers la fiche du circuit.
  const retour = first(query.retour);
  const fromAccount =
    typeof retour === "string" &&
    retour.startsWith(`/a/${slug}/mon-compte`) &&
    !retour.includes("//")
      ? retour
      : null;
  const back = fromAccount
    ? { href: fromAccount, label: "Retour à mon espace" }
    : { href: `/a/${slug}/circuits/${circuit.slug}`, label: "Retour au circuit" };

  // Groupe de la réservation : seulement pour son titulaire connecté (nombre, guide).
  const reservationId = first(query.reservation);
  const user = reservationId ? await getCurrentUser() : null;
  const party =
    reservationId && user?.role === "CLIENT" && user.agenceId === agence.id
      ? await visitParty(db, reservationId, user.id)
      : null;

  const geometry = circuit.trace?.geometry;
  const line: [number, number][] =
    geometry && geometry.line.length > 1
      ? geometry.line
      : circuit.etapes.map((s) => [s.etape.latitude, s.etape.longitude]);
  const path = circuit.trace?.path ?? circuit.etapes.map((s) => s.etape);
  const waypoints = await visitWaypoints(db, path);

  const steps = circuit.etapes.map((s) => ({
    ordre: s.ordre,
    nom: s.etape.nom,
    type: TYPE_ETAPE_LABELS[s.etape.type],
    description: s.etape.description,
    latitude: s.etape.latitude,
    longitude: s.etape.longitude,
    jour: s.jour,
  }));
  const traces = {
    relevés: geometry?.traces ?? 0,
    total: geometry?.legs ?? circuit.etapes.length - 1,
  };

  // Adresses des deux modes, en gardant le retour et la réservation.
  const keep = new URLSearchParams();
  if (fromAccount) keep.set("retour", fromAccount);
  if (reservationId) keep.set("reservation", reservationId);
  const base = `/a/${slug}/visite/${circuit.slug}`;
  const lightQuery = new URLSearchParams(keep);
  lightQuery.set("mode", "carte");
  const lightHref = `${base}?${lightQuery}`;
  const gameHref = keep.size > 0 ? `${base}?${keep}` : base;

  const light = (
    <VirtualTourEntry
      agenceNom={agence.nom}
      titre={circuit.titre}
      steps={steps}
      line={line}
      traces={traces}
      back={back}
      fallback={
        <div className="grid h-dvh place-items-center bg-[#061b20] p-6 text-center text-white">
          <div>
            <p className="font-display text-2xl">Visite virtuelle indisponible</p>
            <p className="mt-2 text-white/75">
              Votre navigateur ne sait pas afficher la 3D (WebGL).
            </p>
            <Link href={back.href} className="mt-4 inline-block underline">
              {back.label}
            </Link>
          </div>
        </div>
      }
    />
  );

  return (
    <main id="contenu" className="relative h-dvh">
      {first(query.mode) === "carte" ? (
        <>
          {light}
          <Link
            href={gameHref}
            className="gt3d-glass absolute right-3 bottom-40 z-10 px-3 py-1.5 text-[11px] text-white/85 sm:right-5 sm:bottom-36"
          >
            Passer en mode jeu
          </Link>
        </>
      ) : (
        <GameTourEntry
          agenceNom={agence.nom}
          titre={circuit.titre}
          steps={steps}
          line={line}
          waypoints={waypoints}
          traces={traces}
          party={party}
          back={back}
          lightHref={lightHref}
          fallback={light}
        />
      )}
    </main>
  );
}
