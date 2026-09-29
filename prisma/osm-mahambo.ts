/**
 * Lieux RÉELS de la côte Est de Madagascar (régions Analanjirofo et Atsinanana), extraits
 * d'OpenStreetMap le 2026-09-29 par deux requêtes Overpass :
 * 1. `MAHAMBO_OSM_PLACES` : nœuds `place` nommés à moins de 12 km du village de Mahambo ;
 * 2. `COTE_EST_OSM_PLACES` : sélection de villes et de villages nommés à moins de 70 km
 *    (côte de Foulpointe à Soanierana Ivongo, arrière-pays de Vavatenina, île Sainte-Marie),
 *    pour que le graphe de démonstration couvre une région réaliste.
 *
 * Source : © contributeurs OpenStreetMap, données sous licence ODbL
 * (https://www.openstreetmap.org/copyright). L'identifiant du nœud permet de vérifier
 * chaque point : https://www.openstreetmap.org/node/<osmId>
 *
 * TODO(données terrain) :
 * - vérifier que ces lieux sont bien sur les sentiers de Green Trek Mada ;
 * - « Ambodiforaha », extrémité du sentier officiel, N'EXISTE PAS dans OpenStreetMap : il
 *   n'est donc pas créé ici (aucune coordonnée inventée). À placer sur la carte par
 *   l'agence, à partir d'un relevé GPS de terrain.
 */
export type OsmPlace = {
  nom: string;
  osmId: number;
  osmPlace: string;
  latitude: number;
  longitude: number;
};

export const MAHAMBO_OSM_PLACES: readonly OsmPlace[] = [
  {
    nom: "Mahambo",
    osmId: 11920200501,
    osmPlace: "village",
    latitude: -17.4896484,
    longitude: 49.4503963,
  },
  {
    nom: "Mahambo Doany",
    osmId: 669178677,
    osmPlace: "neighbourhood",
    latitude: -17.4810892,
    longitude: 49.4627601,
  },
  {
    nom: "Morafeno",
    osmId: 11938136303,
    osmPlace: "hamlet",
    latitude: -17.5171983,
    longitude: 49.4482612,
  },
  {
    nom: "Agnalambany",
    osmId: 6652664671,
    osmPlace: "hamlet",
    latitude: -17.5204024,
    longitude: 49.4526203,
  },
  {
    nom: "Antsikafoka",
    osmId: 11938319835,
    osmPlace: "village",
    latitude: -17.4482799,
    longitude: 49.4339758,
  },
  {
    nom: "Ambinany Iazafo",
    osmId: 617857753,
    osmPlace: "village",
    latitude: -17.4375711,
    longitude: 49.432507,
  },
  {
    nom: "Tanambao Sahorana",
    osmId: 617857754,
    osmPlace: "village",
    latitude: -17.410646,
    longitude: 49.4377265,
  },
  {
    nom: "Namahoaka",
    osmId: 6610083632,
    osmPlace: "hamlet",
    latitude: -17.580529,
    longitude: 49.4625707,
  },
];

/** Villes et villages réels de la côte Est, à moins de 70 km de Mahambo (même source). */
export const COTE_EST_OSM_PLACES: readonly OsmPlace[] = [
  {
    nom: "Fenoarivo Atsinanana",
    osmId: 671507246,
    osmPlace: "town",
    latitude: -17.382029,
    longitude: 49.4099733,
  },
  {
    nom: "Mahavelona",
    osmId: 2408636306,
    osmPlace: "town",
    latitude: -17.6788734,
    longitude: 49.5118525,
  },
  {
    nom: "Vavatenina",
    osmId: 2959022915,
    osmPlace: "town",
    latitude: -17.4675002,
    longitude: 49.19623,
  },
  {
    nom: "Soanierana Ivongo",
    osmId: 671561243,
    osmPlace: "town",
    latitude: -16.920327,
    longitude: 49.585367,
  },
  {
    nom: "Ambodifototra",
    osmId: 678832056,
    osmPlace: "town",
    latitude: -16.9996379,
    longitude: 49.8525772,
  },
  {
    nom: "Rantolava",
    osmId: 1963736818,
    osmPlace: "village",
    latitude: -17.2503282,
    longitude: 49.4297584,
  },
  {
    nom: "Ampasina Maningory",
    osmId: 617857761,
    osmPlace: "village",
    latitude: -17.2188716,
    longitude: 49.4077275,
  },
  {
    nom: "Mahasoa",
    osmId: 617857781,
    osmPlace: "village",
    latitude: -17.1423921,
    longitude: 49.4955961,
  },
  {
    nom: "Anjahambe",
    osmId: 617857785,
    osmPlace: "village",
    latitude: -17.1210471,
    longitude: 49.5011422,
  },
  {
    nom: "Manankinany",
    osmId: 617857796,
    osmPlace: "village",
    latitude: -17.0399003,
    longitude: 49.5295768,
  },
  {
    nom: "Ampasimbe",
    osmId: 2056698492,
    osmPlace: "village",
    latitude: -17.6341548,
    longitude: 49.382254,
  },
  {
    nom: "Ambodihazomamy",
    osmId: 13556493011,
    osmPlace: "village",
    latitude: -17.7786719,
    longitude: 49.4233355,
  },
  {
    nom: "Nosibe",
    osmId: 4912499617,
    osmPlace: "village",
    latitude: -17.8791817,
    longitude: 49.4584363,
  },
  {
    nom: "Ambodiatafana",
    osmId: 6610083815,
    osmPlace: "village",
    latitude: -17.9521022,
    longitude: 49.4250579,
  },
  {
    nom: "Antetezambaro",
    osmId: 6610058646,
    osmPlace: "village",
    latitude: -18.0119932,
    longitude: 49.4034468,
  },
  {
    nom: "Ambodimanga",
    osmId: 10610406491,
    osmPlace: "village",
    latitude: -17.4921438,
    longitude: 49.2872711,
  },
  {
    nom: "Vavazahana",
    osmId: 12050651575,
    osmPlace: "village",
    latitude: -17.5417043,
    longitude: 49.2414865,
  },
  {
    nom: "Mahavanona",
    osmId: 8476090702,
    osmPlace: "village",
    latitude: -17.3095329,
    longitude: 49.3920368,
  },
  {
    nom: "Vohilava",
    osmId: 3797160775,
    osmPlace: "village",
    latitude: -17.0658073,
    longitude: 49.825525,
  },
];
