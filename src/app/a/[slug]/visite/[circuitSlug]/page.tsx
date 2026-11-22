import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { VirtualTourEntry } from "@/components/visit/virtual-tour-entry";
import { getVitrineAgency } from "@/lib/public-agency";
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

/**
 * Visite virtuelle d'un circuit (étape 8a) : page publique en plein écran, ouverte depuis la
 * fiche du circuit ou depuis l'espace voyageur (réservations). Circuit publié seulement
 * (RG 9) ; même agence que l'adresse (client confiné).
 */
export default async function VisitePage({ params, searchParams }: Props) {
  const { slug, circuitSlug } = await params;
  const { agence, db } = await loadVitrine(slug);
  const circuit = await getPublicCircuit(db, circuitSlug);
  if (!circuit || circuit.etapes.length < 2) notFound();

  // Retour : vers l'espace voyageur de CETTE agence s'il est demandé (adresse vérifiée :
  // jamais de redirection vers un autre site), sinon vers la fiche du circuit.
  const retour = (await searchParams).retour;
  const fromAccount =
    typeof retour === "string" &&
    retour.startsWith(`/a/${slug}/mon-compte`) &&
    !retour.includes("//")
      ? retour
      : null;
  const back = fromAccount
    ? { href: fromAccount, label: "Retour à mon espace" }
    : { href: `/a/${slug}/circuits/${circuit.slug}`, label: "Retour au circuit" };

  const geometry = circuit.trace?.geometry;
  const line: [number, number][] =
    geometry && geometry.line.length > 1
      ? geometry.line
      : circuit.etapes.map((s) => [s.etape.latitude, s.etape.longitude]);

  return (
    <main id="contenu" className="h-dvh">
      <VirtualTourEntry
        agenceNom={agence.nom}
        titre={circuit.titre}
        steps={circuit.etapes.map((s) => ({
          ordre: s.ordre,
          nom: s.etape.nom,
          type: TYPE_ETAPE_LABELS[s.etape.type],
          description: s.etape.description,
          latitude: s.etape.latitude,
          longitude: s.etape.longitude,
          jour: s.jour,
        }))}
        line={line}
        traces={{
          relevés: geometry?.traces ?? 0,
          total: geometry?.legs ?? circuit.etapes.length - 1,
        }}
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
    </main>
  );
}
