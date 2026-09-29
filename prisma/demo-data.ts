/**
 * Générateur des données de DÉMONSTRATION (cahier des charges §11) : circuits, départs,
 * réservations, participants et paiements, pour que les tableaux de bord soient lisibles.
 *
 * - Fonction PURE et DÉTERMINISTE : même graine + même date → mêmes données (testée).
 * - Toutes les personnes sont FICTIVES. Les circuits de Green Trek Mada sont marqués
 *   « [DÉMO] » et leurs prix, durées et capacités sont fictifs : TODO(données terrain).
 * - Respecte les règles de gestion : RG 10 (fin ≥ début), RG 11 (COMPLETE quand plein),
 *   RG 13 (jamais plus de personnes que de places), RG 14 (montant = prix × personnes,
 *   figé), RG 16 (paiements validés ≤ montant). Vérifié par `tests/unit/demo-data.test.ts`.
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
  payeLe: Date | null;
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
  participants: { nom: string; prenom: string; age: number }[];
  paiements: DemoPaiement[];
};

export type DemoAgencyData = {
  circuits: DemoCircuit[];
  sessions: DemoSession[];
  reservations: DemoReservation[];
};

type AgencySpec = {
  /** Préfixe des références de réservation (ex. « GT »). */
  prefix: string;
  circuits: DemoCircuit[];
  /** Nombre de clients fictifs disponibles (index 0 = le client de démonstration). */
  clientCount: number;
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

/** Décalages (en jours, depuis aujourd'hui) des départs de chaque circuit. */
const SESSION_OFFSETS: readonly (readonly number[])[] = [
  [-280, -150, -40, 12, 55],
  [-220, -95, -18, 26],
  [-120, -9, 40],
  [-60, 20, 75],
];

const PRENOMS = ["Hery", "Lalao", "Mialy", "Tojo", "Anja", "Fara", "Niry", "Voahirana", "Sitraka"];

export function generateAgencyDemo(spec: AgencySpec, now: Date): DemoAgencyData {
  const random = createRandom(spec.seed);
  const sessions: DemoSession[] = [];
  const reservations: DemoReservation[] = [];

  spec.circuits.forEach((circuit, circuitIndex) => {
    const offsets = SESSION_OFFSETS[circuitIndex % SESSION_OFFSETS.length] ?? [];
    for (const offset of offsets) {
      const dateDebut = dayAt(now, offset);
      const dateFin = dayAt(now, offset + circuit.dureeJours - 1); // RG 10 : fin ≥ début
      const isPast = dateFin.getTime() < dayAt(now, 0).getTime();
      const placesTotal = Math.min(circuit.capaciteMax, random.pick([6, 8, 10, 12]));
      // Un départ sur cinq a un prix spécifique (ex. haute saison), remplaçant celui du circuit.
      const prixParPersonne =
        random.next() < 0.2 ? Math.round((circuit.prixParPersonne * 1.15) / 1000) * 1000 : null;
      const annule = !isPast && offset === 75; // un départ futur annulé, pour la démonstration
      sessions.push({
        circuitIndex,
        dateDebut,
        dateFin,
        placesTotal,
        prixParPersonne,
        statut: annule ? "ANNULEE" : isPast ? "TERMINEE" : "OUVERTE",
        withGuide: random.next() < 0.8,
      });
    }
  });

  sessions.forEach((session, sessionIndex) => {
    if (session.statut === "ANNULEE") return;
    const circuit = spec.circuits[session.circuitIndex];
    if (!circuit) return;
    const isPast = session.statut === "TERMINEE";
    const prix = session.prixParPersonne ?? circuit.prixParPersonne;
    let placesRestantes = session.placesTotal;
    const wanted = random.int(1, 4);

    for (let i = 0; i < wanted && placesRestantes > 0; i += 1) {
      // RG 13 : on ne réserve jamais plus que les places restantes.
      const nombrePersonnes = Math.min(random.int(1, 4), placesRestantes);
      // Réservation faite 3 à 45 jours avant le départ ; pour un départ proche, cette date
      // tomberait dans le futur : on l'étale alors sur les 4 dernières semaines.
      const joursAvant = random.int(3, 45);
      const ideal = session.dateDebut.getTime() - joursAvant * DAY - random.int(2, 14) * HOUR;
      const createdAt = new Date(
        ideal < now.getTime() - DAY
          ? ideal
          : now.getTime() - random.int(0, 27) * DAY - random.int(1, 20) * HOUR,
      );
      const roll = random.next();
      const statut: DemoReservation["statut"] = isPast
        ? roll < 0.12
          ? "ANNULEE"
          : "TERMINEE"
        : roll < 0.1
          ? "ANNULEE"
          : roll < 0.4
            ? "EN_ATTENTE"
            : "CONFIRMEE";
      if (statut !== "ANNULEE") placesRestantes -= nombrePersonnes;

      const montantTotal = prix * nombrePersonnes; // RG 14 : figé à la création
      // Aucun événement dans le futur : confirmation et annulation au plus tard « maintenant ».
      const notAfterNow = (time: number) => new Date(Math.min(time, now.getTime() - 5 * 60_000));
      const confirmeeAt =
        statut === "CONFIRMEE" || statut === "TERMINEE"
          ? notAfterNow(createdAt.getTime() + DAY / 2)
          : null;
      const annuleeAt = statut === "ANNULEE" ? notAfterNow(createdAt.getTime() + 2 * DAY) : null;

      const paiements: DemoPaiement[] = [];
      const methode = random.pick([
        "ESPECES",
        "MOBILE_MONEY",
        "VIREMENT",
        "CARTE_SIMULEE",
      ] as const);
      if (statut === "TERMINEE") {
        paiements.push({ montant: montantTotal, methode, statut: "VALIDE", payeLe: confirmeeAt });
      } else if (statut === "CONFIRMEE") {
        // Acompte de 30 % validé ; le solde reste à régler (RG 16 : total validé ≤ montant).
        const acompte = Math.round((montantTotal * 0.3) / 1000) * 1000;
        paiements.push({ montant: acompte, methode, statut: "VALIDE", payeLe: confirmeeAt });
      } else if (statut === "EN_ATTENTE" && random.next() < 0.5) {
        paiements.push({
          montant: montantTotal,
          methode: "MOBILE_MONEY",
          statut: "EN_ATTENTE",
          payeLe: null,
        });
      }

      reservations.push({
        sessionIndex,
        // Le client de démonstration (index 0) reçoit une réservation sur trois.
        clientIndex: random.next() < 0.33 ? 0 : random.int(1, spec.clientCount - 1),
        reference: "",
        nombrePersonnes,
        montantTotal,
        statut,
        createdAt,
        confirmeeAt,
        annuleeAt,
        participants: Array.from({ length: nombrePersonnes }, (_, n) => ({
          nom: "Démo",
          prenom: `${random.pick(PRENOMS)} ${n + 1}`,
          age: random.int(12, 68),
        })),
        paiements,
      });
    }

    // RG 11 : un départ futur sans place restante passe à COMPLETE.
    if (!isPast && placesRestantes === 0) session.statut = "COMPLETE";
  });

  // Références lisibles et uniques, dans l'ordre chronologique de création.
  reservations
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .forEach((reservation, index) => {
      reservation.reference = `${spec.prefix}-${reservation.createdAt.getUTCFullYear()}-${String(index + 1).padStart(4, "0")}`;
    });

  return { circuits: spec.circuits, sessions, reservations };
}

/* ─── Étapes (nœuds du graphe) et itinéraires de démonstration ───────────────── */

export type DemoEtape = {
  nom: string;
  type: "VILLAGE" | "POINT_INTERET" | "HEBERGEMENT" | "RESTAURATION" | "EMBARCADERE" | "AUTRE";
  latitude: number;
  longitude: number;
  description: string;
};

/**
 * Graphe de démonstration d'une agence : ses étapes, et pour chaque circuit (même index que
 * la liste des circuits) la suite ordonnée des étapes (index dans `etapes`). RG 4 : au moins
 * deux étapes par circuit (les circuits de démonstration sont publiés).
 */
export type DemoGraph = { etapes: DemoEtape[]; itineraires: number[][] };

const ITINERAIRE_DEMO = "TODO(données terrain) : itinéraire de démonstration.";

/** Green Trek Mada : lieux RÉELS d'OpenStreetMap (voir prisma/osm-mahambo.ts). */
function fromOsm(place: OsmPlace): DemoEtape {
  return {
    nom: place.nom,
    // Soanierana Ivongo est le port d'embarquement vers l'île Sainte-Marie.
    type: place.nom === "Soanierana Ivongo" ? "EMBARCADERE" : "VILLAGE",
    latitude: place.latitude,
    longitude: place.longitude,
    description:
      `Lieu OpenStreetMap (nœud ${place.osmId}, « ${place.osmPlace} ») ; © contributeurs OpenStreetMap, ODbL. ` +
      "TODO(données terrain) : vérifier que ce lieu est sur les sentiers de l'agence.",
  };
}

export const GREEN_TREK_GRAPH: DemoGraph = {
  // Les lieux autour de Mahambo d'abord (index 0 à 7, utilisés par les itinéraires),
  // puis les villes et villages de la côte Est (réalisme de la carte).
  etapes: [...MAHAMBO_OSM_PLACES, ...COTE_EST_OSM_PLACES].map(fromOsm),
  // 0 Mahambo, 1 Mahambo Doany, 2 Morafeno, 3 Agnalambany, 4 Antsikafoka,
  // 5 Ambinany Iazafo, 6 Tanambao Sahorana, 7 Namahoaka
  itineraires: [
    [1, 0], // Sentier Mahambo Doany – Ambodiforaha (Ambodiforaha reste à placer)
    [0, 2, 3, 7], // Randonnée côtière et pirogue
    [0, 4, 5, 6], // Immersion au village
    [1, 0, 2], // Journée découverte
  ],
};

const LIEU_FICTIF = "Lieu FICTIF de l'agence de démonstration (coordonnées fictives).";

export const DEMO_ALPHA_GRAPH: DemoGraph = {
  etapes: [
    {
      nom: "Col des Brumes (fictif)",
      type: "POINT_INTERET",
      latitude: -19.82,
      longitude: 47.05,
      description: LIEU_FICTIF,
    },
    {
      nom: "Lac Bleu (fictif)",
      type: "POINT_INTERET",
      latitude: -19.86,
      longitude: 47.09,
      description: LIEU_FICTIF,
    },
    {
      nom: "Village du Plateau (fictif)",
      type: "VILLAGE",
      latitude: -19.9,
      longitude: 47.03,
      description: LIEU_FICTIF,
    },
    {
      nom: "Camp du Volcan (fictif)",
      type: "HEBERGEMENT",
      latitude: -19.94,
      longitude: 47.07,
      description: LIEU_FICTIF,
    },
    {
      nom: "Cascade Haute (fictif)",
      type: "POINT_INTERET",
      latitude: -19.84,
      longitude: 46.99,
      description: LIEU_FICTIF,
    },
  ],
  itineraires: [
    [0, 1, 2, 3],
    [1, 4, 2],
    [2, 0],
  ],
};

export const DEMO_BETA_GRAPH: DemoGraph = {
  etapes: [
    {
      nom: "Entrée du Canyon (fictif)",
      type: "POINT_INTERET",
      latitude: -22.52,
      longitude: 45.38,
      description: LIEU_FICTIF,
    },
    {
      nom: "Piscine naturelle (fictif)",
      type: "POINT_INTERET",
      latitude: -22.55,
      longitude: 45.41,
      description: LIEU_FICTIF,
    },
    {
      nom: "Embarcadère de la rivière (fictif)",
      type: "EMBARCADERE",
      latitude: -22.58,
      longitude: 45.36,
      description: LIEU_FICTIF,
    },
    {
      nom: "Village des Orchidées (fictif)",
      type: "VILLAGE",
      latitude: -22.5,
      longitude: 45.44,
      description: LIEU_FICTIF,
    },
  ],
  itineraires: [
    [0, 1, 3],
    [3, 2],
    [2, 1, 0],
  ],
};

export { ITINERAIRE_DEMO };

/* ─── Circuits de démonstration par agence ───────────────────────────────────── */

const TODO_TERRAIN =
  "TODO(données terrain) : durée, prix et capacité FICTIFS, pour la démonstration uniquement.";

/** Green Trek Mada : seul le sentier « Mahambo Doany – Ambodiforaha » est connu (§11). */
export const GREEN_TREK_CIRCUITS: DemoCircuit[] = [
  {
    titre: "[DÉMO] Sentier Mahambo Doany – Ambodiforaha",
    slug: "demo-mahambo-doany-ambodiforaha",
    resume: "Le sentier emblématique de l'agence, entre villages et littoral.",
    description:
      `${TODO_TERRAIN} Itinéraire incomplet : Ambodiforaha, extrémité du sentier, est absent ` +
      "d'OpenStreetMap et reste à placer sur la carte à partir d'un relevé de terrain.",
    difficulte: "MOYENNE",
    dureeJours: 2,
    prixParPersonne: 180_000,
    capaciteMax: 10,
  },
  {
    titre: "[DÉMO] Randonnée côtière et pirogue",
    slug: "demo-randonnee-cotiere-pirogue",
    resume: "Une journée à pied le long de la côte, retour en pirogue.",
    description: TODO_TERRAIN,
    difficulte: "FACILE",
    dureeJours: 1,
    prixParPersonne: 95_000,
    capaciteMax: 8,
  },
  {
    titre: "[DÉMO] Immersion au village",
    slug: "demo-immersion-village",
    resume: "Trois jours au rythme d'un village partenaire.",
    description: TODO_TERRAIN,
    difficulte: "MOYENNE",
    dureeJours: 3,
    prixParPersonne: 320_000,
    capaciteMax: 12,
  },
  {
    titre: "[DÉMO] Journée découverte de Mahambo",
    slug: "demo-decouverte-mahambo",
    resume: "Une première approche, accessible à tous.",
    description: TODO_TERRAIN,
    difficulte: "FACILE",
    dureeJours: 1,
    prixParPersonne: 60_000,
    capaciteMax: 12,
  },
];

const FICTIF = "Circuit FICTIF de l'agence de démonstration.";

export const DEMO_ALPHA_CIRCUITS: DemoCircuit[] = [
  {
    titre: "Traversée des Hautes Terres (fictif)",
    slug: "traversee-hautes-terres",
    resume: "Circuit fictif de démonstration.",
    description: FICTIF,
    difficulte: "DIFFICILE",
    dureeJours: 5,
    prixParPersonne: 650_000,
    capaciteMax: 10,
  },
  {
    titre: "Lacs et volcans (fictif)",
    slug: "lacs-et-volcans",
    resume: "Circuit fictif de démonstration.",
    description: FICTIF,
    difficulte: "MOYENNE",
    dureeJours: 3,
    prixParPersonne: 380_000,
    capaciteMax: 12,
  },
  {
    titre: "Forêt des brumes (fictif)",
    slug: "foret-des-brumes",
    resume: "Circuit fictif de démonstration.",
    description: FICTIF,
    difficulte: "FACILE",
    dureeJours: 1,
    prixParPersonne: 85_000,
    capaciteMax: 12,
  },
];

export const DEMO_BETA_CIRCUITS: DemoCircuit[] = [
  {
    titre: "Canyon rouge (fictif)",
    slug: "canyon-rouge",
    resume: "Circuit fictif de démonstration.",
    description: FICTIF,
    difficulte: "DIFFICILE",
    dureeJours: 4,
    prixParPersonne: 540_000,
    capaciteMax: 8,
  },
  {
    titre: "Rivière des pirogues (fictif)",
    slug: "riviere-des-pirogues",
    resume: "Circuit fictif de démonstration.",
    description: FICTIF,
    difficulte: "FACILE",
    dureeJours: 2,
    prixParPersonne: 150_000,
    capaciteMax: 10,
  },
  {
    titre: "Plateau des orchidées (fictif)",
    slug: "plateau-des-orchidees",
    resume: "Circuit fictif de démonstration.",
    description: FICTIF,
    difficulte: "MOYENNE",
    dureeJours: 2,
    prixParPersonne: 210_000,
    capaciteMax: 12,
  },
];

/* ─── Tronçons de démonstration (arêtes du graphe, étape E5) ─────────────────── */

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

export const TRONCON_DEMO =
  "TODO(données terrain) : tronçon de démonstration (plus proches voisins), sentier et distance à confirmer sur le terrain.";

/**
 * Tronçons de démonstration (décision C de l'étape E5) : chaque étape est reliée à ses `k`
 * plus proches voisines situées à moins de `maxKm` à vol d'oiseau, plus les liens entre
 * étapes consécutives des itinéraires. Distance et durée sont ESTIMÉES (Haversine ×
 * sinuosité, Naismith adaptée) : aucun sentier réel n'est prétendu connu. Tronçons à double
 * sens, une seule arête par paire. Fonction pure et déterministe.
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

  // Connexité du continent : chaque groupe isolé (ex. l'arrière-pays de Vavatenina, à plus de
  // `maxKm`) est relié au groupe principal par la paire de lieux la plus proche. Les îles ne
  // sont PAS reliées à pied : pas de tronçon à travers la mer (cas « aucun chemin », §6.4).
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
