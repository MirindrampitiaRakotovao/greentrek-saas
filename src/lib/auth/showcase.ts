import "server-only";

import type { ShowcaseSlide } from "@/components/auth/auth-showcase";
import { creditFor } from "@/lib/photo-credits";
import { getTenantDb } from "@/lib/tenant";

/**
 * Photos et textes du panneau des pages de connexion et d'inscription. Uniquement des
 * photos créditées (licences libres, §8.1) : le crédit de la photo affichée est visible.
 */

function slide(src: string, fallbackAlt: string): ShowcaseSlide {
  const credit = creditFor(src);
  return {
    src,
    alt: credit?.sujet ?? fallbackAlt,
    credit: credit ? `Photo : ${credit.sujet} · ${credit.auteur}, ${credit.licence}` : null,
  };
}

const PLATEFORME = [
  "/images/circuits/sentier-mahambo-doany-ambodiforaha.jpg",
  "/images/circuits/grande-traversee-isalo.jpg",
  "/images/circuits/randonnee-cotiere-pirogue.jpg",
  "/images/circuits/forets-et-rizieres.jpg",
];

export function platformShowcase() {
  return {
    slides: PLATEFORME.map((src) => slide(src, "Paysage de Madagascar")),
    card: {
      title: "Vos circuits, de la carte à la réservation",
      text: "Sentiers, départs, réservations et itinéraires optimisés : toute votre agence au même endroit.",
    },
    headline: "Faites découvrir Madagascar autrement",
    cta: { label: "Voir les tarifs", href: "/tarifs" },
  };
}

/** Panneau d'une agence : photos de ses circuits publiés (créditées), sinon de la plateforme. */
export async function agencyShowcase(agence: { id: string; nom: string; slug: string }) {
  const circuits = await getTenantDb(agence.id).circuit.findMany({
    where: { statut: "PUBLIE", imagePrincipaleUrl: { not: null } },
    select: { titre: true, imagePrincipaleUrl: true },
    orderBy: { titre: "asc" },
  });
  const slides = circuits
    .filter((c) => creditFor(c.imagePrincipaleUrl))
    .map((c) => slide(c.imagePrincipaleUrl!, c.titre));
  return {
    slides: slides.length > 0 ? slides : platformShowcase().slides,
    card: {
      title: `Voyagez avec ${agence.nom}`,
      text: "Réservez en ligne, suivez vos voyages et échangez avec l'équipe et votre guide.",
    },
    headline: "Votre prochaine randonnée commence ici",
    cta: { label: "Voir les circuits", href: `/a/${agence.slug}/circuits` },
  };
}
