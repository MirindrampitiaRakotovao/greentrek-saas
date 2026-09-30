/**
 * Générateur des données de démonstration (cahier des charges §11, étape E12) : clients,
 * circuits, départs sur 12 mois, réservations, participants, paiements et avis, pour que les
 * tableaux de bord, les listes et le site vitrine soient remplis de façon réaliste.
 *
 * - Fonction PURE et DÉTERMINISTE : même graine + même date → mêmes données (testée).
 * - Textes affichés sans mention « démo » ni « fictif » (décision de l'étudiant, étape E12) ;
 *   l'honnêteté est assurée dans le mémoire et dans docs/AVANCEMENT.md :
 *   · personnes (clients, participants, équipe) : INVENTÉES ; adresses en @example.com,
 *     domaine réservé (RFC 2606) qui ne peut appartenir à personne ; aucun téléphone ;
 *   · Green Trek Mada : entreprise réelle ; lieux réels (OpenStreetMap) ; circuits, prix,
 *     durées et capacités = HYPOTHÈSES à valider avec l'agence, TODO(données terrain) ;
 *   · « Tanety Trek » et « Ranohira Sentiers » : agences INVENTÉES (preuve de l'isolation
 *     multi-agences), sur des lieux réels d'OpenStreetMap (Antsirabe, Isalo).
 * - Respecte les règles de gestion : RG 10 (fin ≥ début), RG 11 (COMPLETE quand plein),
 *   RG 13 (jamais plus de personnes que de places), RG 14 (montant = prix × personnes,
 *   figé), RG 16 (paiements validés ≤ montant), RG 17 (avis seulement pour une réservation
 *   TERMINEE, un seul). Vérifié par `tests/unit/demo-data.test.ts`.
 *
 * Les références entre objets sont des index (circuit n°, départ n°, client n°) : le seed
 * les remplace par les identifiants créés en base.
 */

import { estimateDistanceKm, estimateDurationMinutes } from "@/lib/graph/estimation";
import { haversineKm } from "@/lib/graph/haversine";

import { COTE_EST_OSM_PLACES, MAHAMBO_OSM_PLACES, type OsmPlace } from "./osm-mahambo";

export type DemoCircuit = {
  titre: string;
  slug: string;
  resume: string;
  description: string;
  difficulte: "FACILE" | "MOYENNE" | "DIFFICILE";
  dureeJours: number;
  prixParPersonne: number;
  capaciteMax: number;
};

export type DemoSession = {
  circuitIndex: number;
  dateDebut: Date;
  dateFin: Date;
  placesTotal: number;
  prixParPersonne: number | null;
  statut: "OUVERTE" | "COMPLETE" | "ANNULEE" | "TERMINEE";
  withGuide: boolean;
};

export type DemoPaiement = {
  montant: number;
  methode: "ESPECES" | "MOBILE_MONEY" | "VIREMENT" | "CARTE_SIMULEE";
  statut: "EN_ATTENTE" | "VALIDE" | "ECHOUE" | "REMBOURSE";
  referenceExterne: string | null;
  payeLe: Date | null;
};

export type DemoAvis = {
  note: number;
  commentaire: string;
  statut: "EN_ATTENTE" | "PUBLIE";
  createdAt: Date;
};

export type DemoReservation = {
  sessionIndex: number;
  clientIndex: number;
  reference: string;
  nombrePersonnes: number;
  montantTotal: number;
  statut: "EN_ATTENTE" | "CONFIRMEE" | "ANNULEE" | "TERMINEE";
  createdAt: Date;
  confirmeeAt: Date | null;
  annuleeAt: Date | null;
  remarques: string | null;
  participants: { nom: string; prenom: string; age: number; nationalite: string }[];
  paiements: DemoPaiement[];
  avis: DemoAvis | null;
};

export type DemoAgencyData = {
  circuits: DemoCircuit[];
  sessions: DemoSession[];
  reservations: DemoReservation[];
};

export type DemoPerson = { prenom: string; nom: string; nationalite: string };

type AgencySpec = {
  /** Préfixe des références de réservation (ex. « GT »). */
  prefix: string;
  circuits: DemoCircuit[];
  /** Clients de l'agence (index 0 = le compte client de démonstration). */
  clients: readonly DemoPerson[];
  seed: number;
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Générateur pseudo-aléatoire à graine (mulberry32) : reproductible. */
function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) throw new Error("pick : liste vide");
      return item;
    },
  };
}

/** Minuit (UTC) du jour de `date` décalé de `offsetDays` jours. */
function dayAt(date: Date, offsetDays: number): Date {
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return new Date(start + offsetDays * DAY);
}

/* ─── Personnes inventées ────────────────────────────────────────────────────── */

const PRENOMS_MG = [
  "Hery",
  "Lalao",
  "Mialy",
  "Tojo",
  "Anja",
  "Fara",
  "Niry",
  "Voahirana",
  "Sitraka",
  "Tahina",
  "Rivo",
  "Fanja",
  "Haja",
  "Nomena",
  "Andry",
  "Mamy",
  "Zo",
  "Tiana",
  "Njaka",
  "Lova",
];
const NOMS_MG = [
  "Rakotomalala",
  "Randrianarisoa",
  "Rasoanaivo",
  "Andriamanana",
  "Razafindrakoto",
  "Rabemananjara",
  "Ramanantsoa",
  "Rakotondrabe",
  "Randriamampionona",
  "Ravelojaona",
  "Rasolofonirina",
  "Andrianjafy",
];
const ETRANGERS: readonly (readonly [string, string, string])[] = [
  ["Claire", "Martin", "Française"],
  ["Julien", "Bernard", "Française"],
  ["Élodie", "Petit", "Française"],
  ["Thomas", "Dubois", "Française"],
  ["Camille", "Lefebvre", "Française"],
  ["Nicolas", "Moreau", "Française"],
  ["Sophie", "Laurent", "Belge"],
  ["Lukas", "Schneider", "Allemande"],
  ["Anna", "Weber", "Allemande"],
  ["Marco", "Rossi", "Italienne"],
  ["Giulia", "Bianchi", "Italienne"],
  ["Emma", "Wilson", "Britannique"],
  ["Daniel", "Meier", "Suisse"],
  ["Laura", "Fischer", "Suisse"],
  ["Pierre", "Hoarau", "Française"],
  ["Nathalie", "Payet", "Française"],
];

/**
 * Clients inventés d'une agence : environ deux tiers de voyageurs malgaches, un tiers de
 * visiteurs étrangers. Noms uniques dans l'agence. Déterministe.
 */
export function generateClients(count: number, seed: number): DemoPerson[] {
  const random = createRandom(seed * 7919);
  const seen = new Set<string>();
  const people: DemoPerson[] = [];
  while (people.length < count) {
    const person: DemoPerson =
      random.next() < 0.62
        ? {
            prenom: random.pick(PRENOMS_MG),
            nom: random.pick(NOMS_MG),
            nationalite: "Malagasy",
          }
        : (([prenom, nom, nationalite]) => ({ prenom, nom, nationalite }))(random.pick(ETRANGERS));
    const key = `${person.prenom} ${person.nom}`;
    if (seen.has(key)) continue;
    seen.add(key);
    people.push(person);
  }
  return people;
}

/** Adresse e-mail d'une personne inventée : domaine réservé `example.com` (RFC 2606). */
export function exampleEmail(person: { prenom: string; nom: string }, suffix = ""): string {
  const slug = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z]+/g, "");
  return `${slug(person.prenom)}.${slug(person.nom)}${suffix}@example.com`;
}

/* ─── Réservations ───────────────────────────────────────────────────────────── */

const COMMENTAIRES: Record<number, readonly string[]> = {
  5: [
    "Un séjour magnifique, le guide connaît chaque village et partage beaucoup.",
    "Organisation parfaite du début à la fin, paysages superbes. À refaire !",
    "Accueil chaleureux dans les villages, repas délicieux. Merci à toute l'équipe.",
    "La meilleure façon de découvrir la région, loin des sentiers battus.",
    "Guide attentionné et très disponible, rythme adapté à tout le groupe.",
  ],
  4: [
    "Très belle randonnée, quelques passages plus difficiles que prévu.",
    "Très bonne expérience, hébergement simple mais propre.",
    "Superbe circuit, on aurait aimé une pause de plus pour les photos.",
    "Belles rencontres et beaux paysages, organisation sérieuse.",
  ],
  3: [
    "Bon circuit dans l'ensemble, le départ a pris un peu de retard.",
    "Paysages très beaux, mais la journée était longue pour les enfants.",
  ],
  2: ["Sentier glissant après la pluie, prévoir de meilleures chaussures."],
};

const REMARQUES = [
  "Régime végétarien pour une personne.",
  "Nous arrivons la veille, merci de nous indiquer un hébergement.",
  "Une personne est allergique aux arachides.",
  "Possible de prévoir un transfert depuis Toamasina ?",
  null,
  null,
  null,
  null,
] as const;

/** Moyens de paiement, pondérés : le Mobile Money domine à Madagascar. */
const METHODES = [
  "MOBILE_MONEY",
  "MOBILE_MONEY",
  "MOBILE_MONEY",
  "ESPECES",
  "VIREMENT",
  "CARTE_SIMULEE",
] as const;

export function generateAgencyDemo(spec: AgencySpec, now: Date): DemoAgencyData {
  const random = createRandom(spec.seed);
  const sessions: DemoSession[] = [];
  const reservations: DemoReservation[] = [];
  const today = dayAt(now, 0);

  // Départs : sur les 12 derniers mois et les 5 prochains, tous les 3 à 6 semaines.
  spec.circuits.forEach((circuit, circuitIndex) => {
    let offset = -360 + random.int(0, 25);
    let futureCount = 0;
    while (offset <= 150) {
      const dateDebut = dayAt(now, offset);
      const dateFin = dayAt(now, offset + circuit.dureeJours - 1); // RG 10 : fin ≥ début
      const isPast = dateFin.getTime() < today.getTime();
      const placesTotal = Math.min(circuit.capaciteMax, random.pick([6, 8, 8, 10, 10, 12]));
      // Un départ sur cinq a un prix spécifique (haute saison), qui remplace celui du circuit.
      const prixParPersonne =
        random.next() < 0.2 ? Math.round((circuit.prixParPersonne * 1.15) / 1000) * 1000 : null;
      if (!isPast) futureCount += 1;
      // Le 4e départ à venir du premier circuit est annulé (cas d'annulation d'un départ).
      const annule = !isPast && circuitIndex === 0 && futureCount === 4;
      sessions.push({
        circuitIndex,
        dateDebut,
        dateFin,
        placesTotal,
        prixParPersonne,
        statut: annule ? "ANNULEE" : isPast ? "TERMINEE" : "OUVERTE",
        withGuide: random.next() < 0.85,
      });
      offset += random.int(21, 42);
    }
  });

  sessions.forEach((session, sessionIndex) => {
    if (session.statut === "ANNULEE") return; // aucune réservation sur un départ annulé
    const circuit = spec.circuits[session.circuitIndex];
    if (!circuit) return;
    const isPast = session.statut === "TERMINEE";
    const prix = session.prixParPersonne ?? circuit.prixParPersonne;
    // Remplissage visé : départs passés bien remplis, départs lointains moins.
    const joursAvantDepart = (session.dateDebut.getTime() - today.getTime()) / DAY;
    const cible = isPast
      ? random.int(Math.ceil(session.placesTotal * 0.5), session.placesTotal)
      : joursAvantDepart < 45
        ? random.int(Math.ceil(session.placesTotal * 0.4), session.placesTotal)
        : random.int(0, Math.ceil(session.placesTotal * 0.5));
    let placesRestantes = session.placesTotal;
    let reservees = 0;

    for (let guard = 0; reservees < cible && placesRestantes > 0 && guard < 12; guard += 1) {
      // RG 13 : on ne réserve jamais plus que les places restantes.
      const nombrePersonnes = Math.min(random.pick([1, 2, 2, 2, 3, 4]), placesRestantes);
      // Réservation faite 5 à 75 jours avant le départ, jamais dans le futur.
      const ideal =
        session.dateDebut.getTime() - random.int(5, 75) * DAY - random.int(2, 20) * HOUR;
      const createdAt = new Date(
        ideal < now.getTime() - HOUR
          ? ideal
          : now.getTime() - random.int(0, 20) * DAY - random.int(1, 20) * HOUR,
      );
      const roll = random.next();
      const statut: DemoReservation["statut"] = isPast
        ? roll < 0.1
          ? "ANNULEE"
          : "TERMINEE"
        : roll < 0.08
          ? "ANNULEE"
          : roll < 0.33
            ? "EN_ATTENTE"
            : "CONFIRMEE";
      if (statut !== "ANNULEE") {
        placesRestantes -= nombrePersonnes;
        reservees += nombrePersonnes;
      }

      const montantTotal = prix * nombrePersonnes; // RG 14 : figé à la création
      // Aucun événement dans le futur : au plus tard « maintenant ».
      const notAfterNow = (time: number) => new Date(Math.min(time, now.getTime() - 5 * 60_000));
      const confirmeeAt =
        statut === "CONFIRMEE" || statut === "TERMINEE"
          ? notAfterNow(createdAt.getTime() + random.int(1, 36) * HOUR)
          : null;
      const annuleeAt =
        statut === "ANNULEE" ? notAfterNow(createdAt.getTime() + random.int(1, 10) * DAY) : null;

      const methode = random.pick(METHODES);
      const reference = () =>
        methode === "MOBILE_MONEY" || methode === "CARTE_SIMULEE"
          ? `•••• ${String(random.int(0, 9999)).padStart(4, "0")}`
          : null;
      const acompte = Math.round((montantTotal * 0.3) / 1000) * 1000;
      const paiements: DemoPaiement[] = [];
      const p = random.next();
      if (statut === "TERMINEE") {
        if (p < 0.55) {
          paiements.push({
            montant: montantTotal,
            methode,
            statut: "VALIDE",
            referenceExterne: reference(),
            payeLe: confirmeeAt,
          });
        } else {
          // Acompte à la réservation, solde réglé en espèces le jour du départ.
          paiements.push(
            {
              montant: acompte,
              methode,
              statut: "VALIDE",
              referenceExterne: reference(),
              payeLe: confirmeeAt,
            },
            {
              montant: montantTotal - acompte,
              methode: "ESPECES",
              statut: "VALIDE",
              referenceExterne: null,
              payeLe: notAfterNow(session.dateDebut.getTime() + 8 * HOUR),
            },
          );
        }
      } else if (statut === "CONFIRMEE") {
        if (p < 0.5) {
          paiements.push({
            montant: montantTotal,
            methode,
            statut: "VALIDE",
            referenceExterne: reference(),
            payeLe: confirmeeAt,
          });
        } else if (p < 0.85) {
          // Acompte de 30 % validé ; le solde reste à régler (RG 16 : total validé ≤ montant).
          paiements.push({
            montant: acompte,
            methode,
            statut: "VALIDE",
            referenceExterne: reference(),
            payeLe: confirmeeAt,
          });
        } // sinon : confirmée par l'agence, paiement sur place
      } else if (statut === "EN_ATTENTE") {
        if (p < 0.35) {
          // Virement ou espèces annoncés, à valider par l'agence.
          paiements.push({
            montant: montantTotal,
            methode: random.pick(["VIREMENT", "ESPECES"] as const),
            statut: "EN_ATTENTE",
            referenceExterne: null,
            payeLe: null,
          });
        } else if (p < 0.5) {
          // Paiement refusé (carte ou Mobile Money) : la réservation reste à payer.
          paiements.push({
            montant: montantTotal,
            methode: random.pick(["MOBILE_MONEY", "CARTE_SIMULEE"] as const),
            statut: "ECHOUE",
            referenceExterne: `•••• ${String(random.int(0, 9999)).padStart(4, "0")}`,
            payeLe: null,
          });
        }
      } else if (p < 0.45) {
        // Annulée après un acompte : remboursé, ou encore à rembourser par l'agence.
        paiements.push({
          montant: acompte,
          methode,
          statut: p < 0.33 ? "REMBOURSE" : "VALIDE",
          referenceExterne: reference(),
          payeLe: notAfterNow(createdAt.getTime() + HOUR),
        });
      }

      // Client : environ 6 % des réservations pour le compte client de connexion (index 0),
      // soit une dizaine de séjours, comme un voyageur fidèle (les autres : clients variés).
      const clientIndex = random.next() < 0.06 ? 0 : random.int(1, spec.clients.length - 1);
      const client = spec.clients[clientIndex]!;
      const participants = Array.from({ length: nombrePersonnes }, (_, n) => {
        const person =
          n === 0
            ? client
            : random.next() < 0.5
              ? {
                  ...client,
                  prenom: random.pick(
                    client.nationalite === "Malagasy" ? PRENOMS_MG : ETRANGERS.map((e) => e[0]),
                  ),
                }
              : random.pick(generateClients(1, spec.seed * 100 + sessionIndex * 10 + n));
        return {
          nom: person.nom,
          prenom: person.prenom,
          age: n === 0 ? random.int(22, 66) : random.int(8, 70),
          nationalite: person.nationalite,
        };
      });

      // RG 17 : avis seulement pour une réservation terminée, un seul, après le séjour.
      let avis: DemoAvis | null = null;
      if (statut === "TERMINEE" && random.next() < 0.6) {
        const r = random.next();
        const note = r < 0.5 ? 5 : r < 0.85 ? 4 : r < 0.97 ? 3 : 2;
        const createdAtAvis = session.dateFin.getTime() + random.int(1, 12) * DAY + 10 * HOUR;
        if (createdAtAvis < now.getTime()) {
          avis = {
            note,
            commentaire: random.pick(COMMENTAIRES[note]!),
            // Avis récents encore à modérer par l'agence.
            statut:
              now.getTime() - createdAtAvis < 25 * DAY && random.next() < 0.6
                ? "EN_ATTENTE"
                : "PUBLIE",
            createdAt: new Date(createdAtAvis),
          };
        }
      }

      reservations.push({
        sessionIndex,
        clientIndex,
        reference: "",
        nombrePersonnes,
        montantTotal,
        statut,
        createdAt,
        confirmeeAt,
        annuleeAt,
        remarques: random.pick(REMARQUES),
        participants,
        paiements,
        avis,
      });
    }

    // RG 11 : un départ futur sans place restante passe à COMPLETE.
    if (!isPast && placesRestantes === 0) session.statut = "COMPLETE";
  });

  // Le dernier séjour terminé du compte client de connexion reste sans avis : il permet de
  // montrer le dépôt d'un avis (RG 17) lors de la démonstration.
  const dernierSejour = reservations
    .filter((r) => r.clientIndex === 0 && r.statut === "TERMINEE")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (dernierSejour) dernierSejour.avis = null;

  // Références lisibles et uniques, dans l'ordre chronologique de création.
  reservations
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .forEach((reservation, index) => {
      reservation.reference = `${spec.prefix}-${reservation.createdAt.getUTCFullYear()}-${String(index + 1).padStart(4, "0")}`;
    });

  return { circuits: spec.circuits, sessions, reservations };
}

/* ─── Étapes (nœuds du graphe) et itinéraires ────────────────────────────────── */

export type DemoEtape = {
  nom: string;
  type: "VILLAGE" | "POINT_INTERET" | "HEBERGEMENT" | "RESTAURATION" | "EMBARCADERE" | "AUTRE";
  latitude: number;
  longitude: number;
  description: string;
};

/**
 * Graphe d'une agence : ses étapes, et pour chaque circuit (même index que la liste des
 * circuits) la suite ordonnée des étapes (index dans `etapes`). RG 4 : au moins deux étapes
 * par circuit (les circuits sont publiés).
 */
export type DemoGraph = { etapes: DemoEtape[]; itineraires: number[][] };

/** Source des lieux (licence ODbL : attribution obligatoire). */
const OSM_SOURCE = "Source : OpenStreetMap (© contributeurs OpenStreetMap, ODbL).";

/**
 * Green Trek Mada : lieux RÉELS d'OpenStreetMap (voir prisma/osm-mahambo.ts).
 * TODO(données terrain) : vérifier que chaque lieu est bien sur les sentiers de l'agence.
 */
function fromOsm(place: OsmPlace): DemoEtape {
  const embarcadere = place.nom === "Soanierana Ivongo"; // port vers l'île Sainte-Marie
  return {
    nom: place.nom,
    type: embarcadere ? "EMBARCADERE" : "VILLAGE",
    latitude: place.latitude,
    longitude: place.longitude,
    description: `${embarcadere ? "Port d'embarquement vers l'île Sainte-Marie" : "Localité de la côte Est"}. ${OSM_SOURCE}`,
  };
}

export const GREEN_TREK_GRAPH: DemoGraph = {
  // Les lieux autour de Mahambo d'abord (index 0 à 7, utilisés par les itinéraires),
  // puis les villes et villages de la côte Est (réalisme de la carte).
  etapes: [...MAHAMBO_OSM_PLACES, ...COTE_EST_OSM_PLACES].map(fromOsm),
  // 0 Mahambo, 1 Mahambo Doany, 2 Morafeno, 3 Agnalambany, 4 Antsikafoka,
  // 5 Ambinany Iazafo, 6 Tanambao Sahorana, 7 Namahoaka
  itineraires: [
    [1, 0], // Sentier Mahambo Doany – Ambodiforaha (Ambodiforaha absent d'OSM : à placer)
    [0, 2, 3, 7], // Randonnée côtière et pirogue
    [0, 4, 5, 6], // Immersion au village
    [1, 0, 2], // Journée découverte
  ],
};

/**
 * Tanety Trek (agence inventée) : lieux RÉELS autour d'Antsirabe, relevés dans OpenStreetMap
 * via Nominatim le 2026-09-30 (identifiant OSM entre parenthèses).
 */
export const TANETY_GRAPH: DemoGraph = {
  etapes: [
    {
      nom: "Antsirabe",
      type: "VILLAGE",
      latitude: -19.871403,
      longitude: 47.034667,
      description: `Ville thermale des Hautes Terres (nœud OSM 300272255). ${OSM_SOURCE}`,
    },
    {
      nom: "Lac Andraikiba",
      type: "POINT_INTERET",
      latitude: -19.873766,
      longitude: 46.969381,
      description: `Lac proche d'Antsirabe (chemin OSM 31289531). ${OSM_SOURCE}`,
    },
    {
      nom: "Lac Tritriva",
      type: "POINT_INTERET",
      latitude: -19.928834,
      longitude: 46.924759,
      description: `Lac de cratère volcanique (chemin OSM 31290039). ${OSM_SOURCE}`,
    },
    {
      nom: "Betafo",
      type: "VILLAGE",
      latitude: -19.838545,
      longitude: 46.856229,
      description: `Bourg entouré de rizières (nœud OSM 727308344). ${OSM_SOURCE}`,
    },
    {
      nom: "Vinaninkarena",
      type: "VILLAGE",
      latitude: -19.955724,
      longitude: 47.042129,
      description: `Village au sud d'Antsirabe (nœud OSM 727298908). ${OSM_SOURCE}`,
    },
  ],
  itineraires: [
    [0, 4, 2, 3], // Traversée des Hautes Terres
    [0, 1, 2], // Lacs et volcans
    [0, 4], // Forêts et rizières
  ],
};

/**
 * Ranohira Sentiers (agence inventée) : lieux RÉELS autour du massif de l'Isalo, relevés dans
 * OpenStreetMap via Nominatim le 2026-09-30.
 */
export const RANOHIRA_GRAPH: DemoGraph = {
  etapes: [
    {
      nom: "Ranohira",
      type: "VILLAGE",
      latitude: -22.556748,
      longitude: 45.414119,
      description: `Porte d'entrée du parc de l'Isalo (nœud OSM 316844298). ${OSM_SOURCE}`,
    },
    {
      nom: "Namaza",
      type: "POINT_INTERET",
      latitude: -22.539172,
      longitude: 45.379942,
      description: `Site de Namaza, dans le massif de l'Isalo (nœud OSM 13912215901). ${OSM_SOURCE}`,
    },
    {
      nom: "Parc national de l'Isalo",
      type: "POINT_INTERET",
      latitude: -22.426461,
      longitude: 45.283851,
      description: `Canyons et plateaux de grès (relation OSM 1155249). ${OSM_SOURCE}`,
    },
    {
      nom: "Ilakaka",
      type: "VILLAGE",
      latitude: -22.700384,
      longitude: 45.214739,
      description: `Bourg au sud-ouest de l'Isalo, nommé Andohanilakaka dans OSM (nœud OSM 316844748). ${OSM_SOURCE}`,
    },
  ],
  itineraires: [
    [0, 1, 2], // Grande traversée de l'Isalo
    [0, 1], // Canyons et piscines naturelles
    [0, 3], // Ranohira – Ilakaka par les crêtes
  ],
};

/** Notes d'étape d'un itinéraire : aucune (à compléter par l'agence). */
export const ITINERAIRE_NOTES = null;

/* ─── Circuits ───────────────────────────────────────────────────────────────── */

/**
 * Green Trek Mada : seul le sentier « Mahambo Doany – Ambodiforaha » est connu par la
 * présentation de l'agence (§11). TODO(données terrain) : durées, prix, capacités et
 * programmes de ces quatre circuits sont des HYPOTHÈSES, à valider avec l'agence (écart
 * assumé à la règle 6, décision de l'étudiant à l'étape E12).
 */
export const GREEN_TREK_CIRCUITS: DemoCircuit[] = [
  {
    titre: "Sentier Mahambo Doany – Ambodiforaha",
    slug: "sentier-mahambo-doany-ambodiforaha",
    resume: "Le sentier emblématique de l'agence, entre villages et littoral.",
    description:
      "Deux jours de marche le long de la côte Est, de Mahambo Doany à Ambodiforaha : " +
      "sentiers de village, plages et forêt littorale, avec une nuit chez l'habitant. " +
      "Un guide local accompagne le groupe et présente la vie des villages traversés.",
    difficulte: "MOYENNE",
    dureeJours: 2,
    prixParPersonne: 180_000,
    capaciteMax: 10,
  },
  {
    titre: "Randonnée côtière et pirogue",
    slug: "randonnee-cotiere-pirogue",
    resume: "Une journée à pied le long de la côte, retour en pirogue.",
    description:
      "Départ de Mahambo à pied vers le nord par les villages de pêcheurs, pause baignade, " +
      "puis retour en pirogue avec les piroguiers de Mahambo. Accessible à tous les marcheurs.",
    difficulte: "FACILE",
    dureeJours: 1,
    prixParPersonne: 95_000,
    capaciteMax: 8,
  },
  {
    titre: "Immersion au village",
    slug: "immersion-village",
    resume: "Trois jours au rythme d'un village partenaire.",
    description:
      "Trois jours pour partager le quotidien des villages de l'arrière-pays de Mahambo : " +
      "cultures de girofle et de vanille, repas préparés avec les familles, marche entre les " +
      "hameaux et soirées au village. Hébergement simple chez nos partenaires.",
    difficulte: "MOYENNE",
    dureeJours: 3,
    prixParPersonne: 320_000,
    capaciteMax: 12,
  },
  {
    titre: "Journée découverte de Mahambo",
    slug: "decouverte-mahambo",
    resume: "Une première approche, accessible à tous.",
    description:
      "Une journée pour découvrir Mahambo et ses environs : balade dans le village, plage, " +
      "déjeuner au Vanilla Café et rencontre avec les artisans. Idéal en famille.",
    difficulte: "FACILE",
    dureeJours: 1,
    prixParPersonne: 60_000,
    capaciteMax: 12,
  },
];

/** Tanety Trek (agence inventée) : randonnées des Hautes Terres autour d'Antsirabe. */
export const TANETY_CIRCUITS: DemoCircuit[] = [
  {
    titre: "Traversée des Hautes Terres",
    slug: "traversee-hautes-terres",
    resume: "Cinq jours entre rizières en terrasses, villages et lacs volcaniques.",
    description:
      "Une grande boucle au départ d'Antsirabe par Vinaninkarena, le lac Tritriva et Betafo : " +
      "rizières en terrasses, villages des Hautes Terres et nuits chez l'habitant.",
    difficulte: "DIFFICILE",
    dureeJours: 5,
    prixParPersonne: 650_000,
    capaciteMax: 10,
  },
  {
    titre: "Lacs et volcans",
    slug: "lacs-et-volcans",
    resume: "Les lacs Andraikiba et Tritriva, perles volcaniques du Vakinankaratra.",
    description:
      "Trois jours de marche d'Antsirabe au lac Andraikiba puis au lac de cratère Tritriva, " +
      "par les crêtes et les villages. Nuit en gîte au bord du lac.",
    difficulte: "MOYENNE",
    dureeJours: 3,
    prixParPersonne: 380_000,
    capaciteMax: 12,
  },
  {
    titre: "Forêts et rizières",
    slug: "forets-et-rizieres",
    resume: "Une journée facile au sud d'Antsirabe.",
    description:
      "Balade d'une journée d'Antsirabe à Vinaninkarena à travers les rizières et les bosquets, " +
      "avec déjeuner dans une famille du village.",
    difficulte: "FACILE",
    dureeJours: 1,
    prixParPersonne: 85_000,
    capaciteMax: 12,
  },
];

/** Ranohira Sentiers (agence inventée) : trekking dans le massif de l'Isalo. */
export const RANOHIRA_CIRCUITS: DemoCircuit[] = [
  {
    titre: "Grande traversée de l'Isalo",
    slug: "grande-traversee-isalo",
    resume: "Quatre jours de canyons, plateaux de grès et bivouacs.",
    description:
      "Au départ de Ranohira, quatre jours au cœur du massif de l'Isalo : canyons, plateaux " +
      "ruiniformes, bivouacs sous les étoiles et baignades dans les piscines naturelles.",
    difficulte: "DIFFICILE",
    dureeJours: 4,
    prixParPersonne: 540_000,
    capaciteMax: 8,
  },
  {
    titre: "Canyons et piscines naturelles",
    slug: "canyons-piscines-isalo",
    resume: "Deux jours entre canyons ombragés et bassins d'eau claire.",
    description:
      "De Ranohira à Namaza : marche dans les canyons, baignade dans les piscines naturelles " +
      "et nuit en camp. Rythme tranquille, accessible dès 10 ans.",
    difficulte: "FACILE",
    dureeJours: 2,
    prixParPersonne: 150_000,
    capaciteMax: 10,
  },
  {
    titre: "Ranohira – Ilakaka par les crêtes",
    slug: "cretes-ranohira-ilakaka",
    resume: "Deux jours sur les crêtes de l'Isalo jusqu'à Ilakaka.",
    description:
      "Une traversée par les crêtes, de Ranohira à Ilakaka, avec des panoramas sur le massif " +
      "et une nuit en bivouac.",
    difficulte: "MOYENNE",
    dureeJours: 2,
    prixParPersonne: 210_000,
    capaciteMax: 12,
  },
];

/* ─── Tronçons (arêtes du graphe, étape E5) ──────────────────────────────────── */

export type DemoEdge = { from: number; to: number; distanceKm: number; dureeMinutes: number };

/** Lieux insulaires (île Sainte-Marie) : jamais reliés au continent par un tronçon à pied. */
export const ISLANDS: ReadonlySet<string> = new Set(["Ambodifototra", "Vohilava"]);

/** Ensemble des nœuds atteignables depuis `start` avec les paires « i-j » données. */
function component(start: number, pairs: ReadonlySet<string>): Set<number> {
  const neighbours = new Map<number, number[]>();
  for (const key of pairs) {
    const [i, j] = key.split("-").map(Number) as [number, number];
    neighbours.set(i, [...(neighbours.get(i) ?? []), j]);
    neighbours.set(j, [...(neighbours.get(j) ?? []), i]);
  }
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    for (const next of neighbours.get(queue.shift()!) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

/**
 * Commentaire des tronçons générés : distance ESTIMÉE (champ `distanceEstimee` à vrai,
 * affiché « estimée » dans l'interface). TODO(données terrain) : sentier et distance à
 * confirmer sur le terrain.
 */
export const TRONCON_COMMENTAIRE =
  "Distance estimée (vol d'oiseau × sinuosité) : à confirmer par un relevé de terrain.";

/**
 * Tronçons (décision C de l'étape E5) : chaque étape est reliée à ses `k` plus proches
 * voisines situées à moins de `maxKm` à vol d'oiseau, plus les liens entre étapes consécutives
 * des itinéraires. Distance et durée sont ESTIMÉES (Haversine × sinuosité, Naismith adaptée) :
 * aucun sentier réel n'est prétendu connu. Tronçons à double sens, une seule arête par paire.
 * Fonction pure et déterministe.
 */
export function generateDemoEdges(graph: DemoGraph, k = 3, maxKm = 15): DemoEdge[] {
  const pairs = new Set<string>();
  const add = (i: number, j: number) => {
    if (i !== j) pairs.add(i < j ? `${i}-${j}` : `${j}-${i}`);
  };

  graph.etapes.forEach((etape, i) => {
    graph.etapes
      .map((other, j) => ({ j, km: haversineKm(etape, other) }))
      .filter(({ j, km }) => j !== i && km <= maxKm)
      .sort((x, y) => x.km - y.km || x.j - y.j)
      .slice(0, k)
      .forEach(({ j }) => add(i, j));
  });
  for (const itineraire of graph.itineraires) {
    for (let p = 1; p < itineraire.length; p += 1) add(itineraire[p - 1]!, itineraire[p]!);
  }

  // Connexité du continent : chaque groupe isolé est relié au groupe principal par la paire
  // de lieux la plus proche. Les îles ne sont PAS reliées à pied : pas de tronçon à travers
  // la mer (cas « aucun chemin », §6.4).
  const land = graph.etapes.map((_, i) => i).filter((i) => !ISLANDS.has(graph.etapes[i]!.nom));
  for (;;) {
    const main = component(land[0] ?? 0, pairs);
    const outside = land.filter((i) => !main.has(i));
    if (outside.length === 0) break;
    let best: { i: number; j: number; km: number } | null = null;
    for (const i of main) {
      if (!land.includes(i)) continue;
      for (const j of outside) {
        const km = haversineKm(graph.etapes[i]!, graph.etapes[j]!);
        if (!best || km < best.km) best = { i, j, km };
      }
    }
    if (!best) break;
    add(best.i, best.j);
  }

  return [...pairs].sort().map((key) => {
    const [from, to] = key.split("-").map(Number) as [number, number];
    const distanceKm = estimateDistanceKm(graph.etapes[from]!, graph.etapes[to]!);
    return { from, to, distanceKm, dureeMinutes: estimateDurationMinutes(distanceKm) };
  });
}
