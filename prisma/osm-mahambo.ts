/**
 * Lieux RÉELS autour de Mahambo (Fénérive-Est), extraits d'OpenStreetMap le 2026-09-29
 * (requête Overpass : nœuds `place` nommés à moins de 12 km du village de Mahambo).
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
