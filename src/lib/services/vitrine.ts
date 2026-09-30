import type { Prisma } from "@/generated/prisma/client";
import { calendarDate } from "@/lib/dates";
import { firstBookableDate, parseIsoDate, placesReservees } from "@/lib/departs";
import { circuitRatings, type Note } from "@/lib/services/avis";
import { type CircuitTrace, latestCircuitTrace } from "@/lib/services/itineraires";
import type { TenantDb } from "@/lib/tenant";
import type { VitrineSearch } from "@/lib/validators/vitrine";

/**
 * Lectures du site vitrine public d'une agence (§7.1). Le visiteur n'a pas de session :
 * la page retrouve l'agence par son slug, puis passe ici le client CONFINÉ à cette agence.
 *
 * Toutes les règles de visibilité sont regroupées dans ce fichier :
 * - RG 9 : seuls les circuits PUBLIE sont visibles ;
 * - un départ est proposé s'il est OUVERT, pas encore commencé (au plus tard la veille, voir
 *   `firstBookableDate`), sur un circuit publié, et
 *   qu'il lui reste des places ;
 * - la note moyenne ne compte que les avis PUBLIE (modérés par l'agence) ;
 * - seuls des champs publics sont sélectionnés (jamais les notes internes, les clients,
 *   les coûts des prestations partenaires).
 */

/** Circuit publiable : condition commune à toutes les lectures. */
const PUBLIE = { statut: "PUBLIE" } as const;

const circuitCardSelect = {
  id: true,
  titre: true,
  slug: true,
  resume: true,
  difficulte: true,
  dureeJours: true,
  distanceKm: true,
  prixParPersonne: true,
  capaciteMax: true,
  imagePrincipaleUrl: true,
  _count: { select: { etapes: true } },
} satisfies Prisma.CircuitSelect;

type CircuitCardPayload = Prisma.CircuitGetPayload<{ select: typeof circuitCardSelect }>;

export type PublicDepart = {
  id: string;
  circuitId: string;
  dateDebut: Date;
  dateFin: Date;
  /** Prix effectif : prix du départ, sinon celui du circuit. */
  prix: number;
  placesTotal: number;
  placesLibres: number;
};

export type PublicCircuitCard = CircuitCardPayload & {
  /** Départs réservables correspondant à la recherche, du plus proche au plus lointain. */
  departs: PublicDepart[];
  /** « À partir de » : prix le plus bas parmi ces départs, sinon le prix du circuit. */
  prixMin: number;
  /** Note moyenne des avis publiés (null : aucun avis). */
  note: Note | null;
};

/**
 * Départs réservables : OUVERTS, pas encore commencés, sur un circuit publié, avec au moins
 * une place libre (places libres = places − réservations non annulées).
 */
async function bookableDeparts(
  db: TenantDb,
  from: Date,
  where: Prisma.SessionDepartWhereInput = {},
): Promise<PublicDepart[]> {
  const sessions = await db.sessionDepart.findMany({
    where: { ...where, statut: "OUVERTE", dateDebut: { gte: from }, circuit: PUBLIE },
    orderBy: [{ dateDebut: "asc" }, { id: "asc" }],
    select: {
      id: true,
      circuitId: true,
      dateDebut: true,
      dateFin: true,
      placesTotal: true,
      prixParPersonne: true,
      circuit: { select: { prixParPersonne: true } },
      reservations: {
        where: { statut: { not: "ANNULEE" } },
        select: { nombrePersonnes: true, statut: true },
      },
    },
  });
  return sessions
    .map((s) => ({
      id: s.id,
      circuitId: s.circuitId,
      dateDebut: s.dateDebut,
      dateFin: s.dateFin,
      prix: s.prixParPersonne ?? s.circuit.prixParPersonne,
      placesTotal: s.placesTotal,
      placesLibres: Math.max(0, s.placesTotal - placesReservees(s.reservations)),
    }))
    .filter((d) => d.placesLibres > 0);
}

function toCard(
  circuit: CircuitCardPayload,
  departs: PublicDepart[],
  note: Note | null = null,
): PublicCircuitCard {
  return {
    ...circuit,
    departs,
    note,
    prixMin: departs.length ? Math.min(...departs.map((d) => d.prix)) : circuit.prixParPersonne,
  };
}

/**
 * Recherche (§7.1 : date, nombre de voyageurs, difficulté). Sans date ni nombre de
 * voyageurs, tous les circuits publiés sont listés (ceux qui ont un départ en premier) ;
 * avec l'un de ces critères, seuls les circuits ayant un départ qui y répond.
 */
export async function searchCircuits(
  db: TenantDb,
  search: VitrineSearch,
  now: Date = new Date(),
): Promise<PublicCircuitCard[]> {
  const first = firstBookableDate(calendarDate(now));
  const requested = search.date ? parseIsoDate(search.date) : first;
  const from = requested > first ? requested : first;
  const voyageurs = search.voyageurs ?? 1;

  const circuits = await db.circuit.findMany({
    where: { ...PUBLIE, ...(search.difficulte ? { difficulte: search.difficulte } : {}) },
    select: circuitCardSelect,
    orderBy: { titre: "asc" },
  });
  if (circuits.length === 0) return [];
  const ids = circuits.map((c) => c.id);
  const [bookable, notes] = await Promise.all([
    bookableDeparts(db, from, { circuitId: { in: ids } }),
    circuitRatings(db, ids),
  ]);
  const departs = bookable.filter((d) => d.placesLibres >= voyageurs);

  const needsDepart = Boolean(search.date || search.voyageurs);
  const cards = circuits
    .map((c) =>
      toCard(
        c,
        departs.filter((d) => d.circuitId === c.id),
        notes.get(c.id) ?? null,
      ),
    )
    .filter((c) => !needsDepart || c.departs.length > 0);
  // Circuits avec un départ d'abord (le plus proche en tête), puis les autres par titre.
  return cards.sort((a, b) => {
    const da = a.departs[0]?.dateDebut.getTime() ?? Number.POSITIVE_INFINITY;
    const dbt = b.departs[0]?.dateDebut.getTime() ?? Number.POSITIVE_INFINITY;
    return da - dbt || a.titre.localeCompare(b.titre, "fr");
  });
}

export type UpcomingDepart = PublicDepart & {
  circuit: Pick<
    CircuitCardPayload,
    "titre" | "slug" | "difficulte" | "dureeJours" | "imagePrincipaleUrl"
  >;
};

/** Prochains départs réservables, tous circuits publiés confondus (section « Prochains départs »). */
export async function listUpcomingDeparts(
  db: TenantDb,
  limit = 6,
  now: Date = new Date(),
): Promise<UpcomingDepart[]> {
  const departs = (await bookableDeparts(db, firstBookableDate(calendarDate(now)))).slice(0, limit);
  if (departs.length === 0) return [];
  const circuits = await db.circuit.findMany({
    where: { ...PUBLIE, id: { in: departs.map((d) => d.circuitId) } },
    select: {
      id: true,
      titre: true,
      slug: true,
      difficulte: true,
      dureeJours: true,
      imagePrincipaleUrl: true,
    },
  });
  return departs.flatMap((d) => {
    const circuit = circuits.find((c) => c.id === d.circuitId);
    return circuit ? [{ ...d, circuit }] : [];
  });
}

const circuitDetailSelect = {
  ...circuitCardSelect,
  description: true,
  etapes: {
    orderBy: { ordre: "asc" },
    select: {
      id: true,
      ordre: true,
      jour: true,
      dureeSejourMin: true,
      etape: {
        select: {
          id: true,
          nom: true,
          type: true,
          description: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  },
  partenaires: {
    where: { partenaire: { actif: true } },
    orderBy: { partenaire: { nom: "asc" } },
    // Sans le prix unitaire : c'est un coût interne de l'agence.
    select: {
      id: true,
      prestation: true,
      inclusDansPrix: true,
      partenaire: { select: { nom: true, type: true } },
      etape: { select: { nom: true } },
    },
  },
} satisfies Prisma.CircuitSelect;

export type PublicCircuitDetail = Prisma.CircuitGetPayload<{
  select: typeof circuitDetailSelect;
}> & {
  departs: PublicDepart[];
  prixMin: number;
  trace: CircuitTrace | null;
  note: Note | null;
};

/** Détail d'un circuit publié (null si inexistant, brouillon, archivé ou d'une autre agence). */
export async function getPublicCircuit(
  db: TenantDb,
  slug: string,
  now: Date = new Date(),
): Promise<PublicCircuitDetail | null> {
  const circuit = await db.circuit.findFirst({
    where: { ...PUBLIE, slug },
    select: circuitDetailSelect,
  });
  if (!circuit) return null;
  const [departs, trace, notes] = await Promise.all([
    bookableDeparts(db, firstBookableDate(calendarDate(now)), { circuitId: circuit.id }),
    latestCircuitTrace(db, circuit.id),
    circuitRatings(db, [circuit.id]),
  ]);
  const { prixMin } = toCard(circuit, departs);
  return { ...circuit, departs, prixMin, trace, note: notes.get(circuit.id) ?? null };
}

export type PublicDepartDetail = PublicDepart & {
  circuit: { titre: string; slug: string; dureeJours: number; imagePrincipaleUrl: string | null };
};

/** Départ réservable (page de réservation) : null s'il n'est plus proposé au public. */
export async function getBookableDepart(
  db: TenantDb,
  sessionId: string,
  now: Date = new Date(),
): Promise<PublicDepartDetail | null> {
  const [depart] = await bookableDeparts(db, firstBookableDate(calendarDate(now)), {
    id: sessionId,
  });
  if (!depart) return null;
  const circuit = await db.circuit.findFirst({
    where: { ...PUBLIE, id: depart.circuitId },
    select: { titre: true, slug: true, dureeJours: true, imagePrincipaleUrl: true },
  });
  return circuit ? { ...depart, circuit } : null;
}

/** Partenaires actifs présentés sur le site (nom, type, description, photo). */
export function listPublicPartenaires(db: TenantDb) {
  return db.partenaire.findMany({
    where: { actif: true },
    orderBy: { nom: "asc" },
    select: { id: true, nom: true, type: true, description: true, imageUrl: true },
  });
}
