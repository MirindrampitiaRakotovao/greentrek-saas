/**
 * Crédits des photos livrées avec l'application (`public/images/`), §8.1 : photos propres
 * ou libres de droits, avec attribution. Les licences Creative Commons BY et BY-SA imposent
 * de citer l'auteur, la licence et la source : ces crédits sont affichés sous la photo d'un
 * circuit et sur la page « Crédits photos ».
 *
 * Photos des circuits : Wikimedia Commons, choisies pour représenter des paysages réels de
 * Madagascar (la côte Est pour Green Trek). Métadonnées relevées par l'API de Commons le
 * 2026-09-29. Photos fournies par l'étudiant : source et licence à confirmer.
 */
export type PhotoCredit = {
  /** Ce que montre la photo, et où elle a été prise selon sa source. */
  sujet: string;
  auteur: string;
  licence: string;
  licenceUrl?: string;
  source?: string;
};

const COMMONS = "https://commons.wikimedia.org/wiki/File:";

export const PHOTO_CREDITS: Record<string, PhotoCredit> = {
  "/images/circuits/demo-mahambo-doany-ambodiforaha.jpg": {
    sujet: "Coucher de soleil sur la plage de Mahambo",
    auteur: "NalyRATOVO",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: `${COMMONS}Mahambo_sunset_waves.jpg`,
  },
  "/images/circuits/demo-randonnee-cotiere-pirogue.jpg": {
    sujet: "Pirogue aux environs de Toamasina",
    auteur: "agamitsudo",
    licence: "CC0 (domaine public)",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    source: `${COMMONS}Pirogue-environs-tamatave-madagascar.jpg`,
  },
  "/images/circuits/demo-immersion-village.jpg": {
    sujet: "Habitation traditionnelle au bord du canal des Pangalanes",
    auteur: "Andopascalou",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: `${COMMONS}Madagascar._canal_des_pangalanes._Habitation_traditionnelle.jpg`,
  },
  "/images/circuits/demo-decouverte-mahambo.jpg": {
    sujet: "Caméléon panthère (Furcifer pardalis) photographié à Mahambo",
    auteur: "Bernard Dupont",
    licence: "CC BY-SA 2.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/2.0",
    source: `${COMMONS}Panther_Chameleon_(Furcifer_pardalis)_(7621752378).jpg`,
  },
  "/images/circuits/traversee-hautes-terres.jpg": {
    sujet: "Rizières en terrasses des Hautes Terres",
    auteur: "Hardscarf",
    licence: "CC BY-SA 3.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    source: `${COMMONS}Madagascar_-_rice_terraces.jpg`,
  },
  "/images/circuits/lacs-et-volcans.jpg": {
    sujet: "Lac Tritriva, près d'Antsirabe",
    auteur: "Bernard Gagnon",
    licence: "CC BY-SA 3.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    source: `${COMMONS}Lake_Tritriva_01.jpg`,
  },
  "/images/circuits/foret-des-brumes.jpg": {
    sujet: "Parc national d'Andasibe-Mantadia",
    auteur: "Rod Waddington",
    licence: "CC BY-SA 2.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/2.0",
    source: `${COMMONS}Ansicht_Nationalpark_Andasibe-Mantadia_in_Madagaskar.jpg`,
  },
  "/images/circuits/canyon-rouge.jpg": {
    sujet: "Parc national de l'Isalo",
    auteur: "Bernard Gagnon",
    licence: "CC BY-SA 3.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    source: `${COMMONS}Isalo_National_Park_06.jpg`,
  },
  "/images/circuits/riviere-des-pirogues.jpg": {
    sujet: "Canal des Pangalanes à Mananjary",
    auteur: "Privatemajory",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: `${COMMONS}Canal_des_Pangalanes_%C3%A0_Mananjary.jpg`,
  },
  "/images/circuits/plateau-des-orchidees.jpg": {
    sujet: "Orchidée du parc Mitsinjo, station forestière d'Analamazaotra",
    auteur: "Sitrakiniavo261",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    source: `${COMMONS}Orchid_from_Mitsinjo_Park_at_Analamazaotra_Forest_Station,_Madagascar_-_Oct_2023.jpg`,
  },
};

/** Photos fournies par l'étudiant (site vitrine, partenaires) : TODO(photos Green Trek). */
export const PHOTOS_FOURNIES: readonly { chemin: string; sujet: string }[] = [
  { chemin: "/images/hero-plage.jpg", sujet: "Plage bordée de cocotiers (accueil)" },
  { chemin: "/images/sentier-foret.jpg", sujet: "Sentier en forêt tropicale" },
  { chemin: "/images/plage-couchant.jpg", sujet: "Plage au coucher du soleil" },
  { chemin: "/images/plage-paillote.jpg", sujet: "Paillote sur une plage" },
  { chemin: "/images/collines-riviere.jpg", sujet: "Collines boisées et rivière" },
  { chemin: "/images/foret.jpg", sujet: "Forêt ensoleillée" },
  { chemin: "/images/partenaires/piroguiers-mahambo.jpg", sujet: "Pêcheur en pirogue" },
  { chemin: "/images/partenaires/la-pirogue-hotel.jpg", sujet: "Bâtiment d'hébergement" },
  { chemin: "/images/partenaires/surf-dah-mahambo.jpg", sujet: "Surfeuse sur une vague" },
  { chemin: "/images/partenaires/vanilla-cafe.jpg", sujet: "Enseigne du Vanilla Café" },
];

export function creditFor(imageUrl: string | null | undefined): PhotoCredit | null {
  return imageUrl ? (PHOTO_CREDITS[imageUrl] ?? null) : null;
}
