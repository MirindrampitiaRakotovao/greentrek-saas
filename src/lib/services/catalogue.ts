import type { PrismaClient } from "@/generated/prisma/client";
import { creditFor } from "@/lib/photo-credits";
import { listPublicAvis } from "@/lib/services/avis";
import {
  getPublicCircuit,
  type PublicCircuitCard,
  type PublicDepart,
  searchCircuits,
} from "@/lib/services/vitrine";
import { getTenantDb } from "@/lib/tenant";
import type { CatalogueQuery } from "@/lib/validators/mobile";

/**
 * Catalogue de l'application mobile (après E12) : circuits PUBLIÉS de toutes les agences
 * ACTIVES (RG 9, RG 19). Chaque agence est lue par son client confiné et par les mêmes
 * fonctions que son site vitrine : mêmes règles de visibilité, de places et de prix.
 * Réponses en JSON simple : dates calendaires « AAAA-MM-JJ », aucune donnée interne.
 */

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** Distance au centième de kilomètre (sans les résidus des calculs en virgule flottante). */
const roundKm = (km: number | null) => (km === null ? null : Math.round(km * 100) / 100);

type AgenceRef = {
  slug: string;
  nom: string;
  ville: string | null;
  logoUrl: string | null;
  devise: string;
};

export type CatalogueDepart = {
  id: string;
  dateDebut: string;
  dateFin: string;
  prix: number;
  placesLibres: number;
};

function toDepart(d: PublicDepart): CatalogueDepart {
  return {
    id: d.id,
    dateDebut: isoDay(d.dateDebut),
    dateFin: isoDay(d.dateFin),
    prix: d.prix,
    placesLibres: d.placesLibres,
  };
}

function photo(imageUrl: string | null) {
  const credit = creditFor(imageUrl);
  return {
    image: imageUrl,
    credit: credit ? `Photo : ${credit.sujet} · ${credit.auteur}, ${credit.licence}` : null,
  };
}

export type CatalogueCircuit = {
  agence: AgenceRef;
  slug: string;
  titre: string;
  resume: string | null;
  difficulte: string;
  dureeJours: number;
  distanceKm: number | null;
  image: string | null;
  credit: string | null;
  prixMin: number;
  note: { moyenne: number; nombre: number } | null;
  prochainDepart: CatalogueDepart | null;
};

function toCircuit(agence: AgenceRef, c: PublicCircuitCard): CatalogueCircuit {
  const first = c.departs[0];
  return {
    agence,
    slug: c.slug,
    titre: c.titre,
    resume: c.resume,
    difficulte: c.difficulte,
    dureeJours: c.dureeJours,
    distanceKm: roundKm(c.distanceKm),
    ...photo(c.imagePrincipaleUrl),
    prixMin: c.prixMin,
    note: c.note,
    prochainDepart: first ? toDepart(first) : null,
  };
}

const agenceSelect = { id: true, slug: true, nom: true, ville: true, logoUrl: true, devise: true };

/** Agences actives ; « q » cherche dans le titre, le résumé, l'agence et sa ville. */
export async function listCatalogue(
  client: PrismaClient,
  query: CatalogueQuery,
  now: Date = new Date(),
): Promise<{ agences: AgenceRef[]; circuits: CatalogueCircuit[] }> {
  const agences = await client.agence.findMany({
    where: { statut: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: agenceSelect,
  });
  const parAgence = await Promise.all(
    agences.map(async ({ id, ...ref }) => {
      const cards = await searchCircuits(getTenantDb(id, client), query, now);
      return cards.map((c) => toCircuit(ref, c));
    }),
  );
  const q = query.q?.toLocaleLowerCase("fr");
  const circuits = parAgence
    .flat()
    .filter(
      (c) =>
        !q ||
        [c.titre, c.resume, c.agence.nom, c.agence.ville].some((v) =>
          v?.toLocaleLowerCase("fr").includes(q),
        ),
    )
    // Départ le plus proche d'abord ; sans départ, les mieux notés.
    .sort(
      (a, b) =>
        (a.prochainDepart?.dateDebut ?? "9999").localeCompare(
          b.prochainDepart?.dateDebut ?? "9999",
        ) ||
        (b.note?.moyenne ?? 0) - (a.note?.moyenne ?? 0) ||
        a.titre.localeCompare(b.titre, "fr"),
    );
  return {
    agences: agences.map((a) => ({
      slug: a.slug,
      nom: a.nom,
      ville: a.ville,
      logoUrl: a.logoUrl,
      devise: a.devise,
    })),
    circuits,
  };
}

/** Fiche d'un circuit publié d'une agence active (null sinon : réponse 404). */
export async function getCatalogueCircuit(
  client: PrismaClient,
  agenceSlug: string,
  circuitSlug: string,
  now: Date = new Date(),
) {
  const agence = await client.agence.findFirst({
    where: { slug: agenceSlug, statut: "ACTIVE" },
    select: agenceSelect,
  });
  if (!agence) return null;
  const db = getTenantDb(agence.id, client);
  const circuit = await getPublicCircuit(db, circuitSlug, now);
  if (!circuit) return null;
  const avis = await listPublicAvis(db, { circuitId: circuit.id, take: 6 });
  return {
    agence: {
      slug: agence.slug,
      nom: agence.nom,
      ville: agence.ville,
      logoUrl: agence.logoUrl,
      devise: agence.devise,
    },
    slug: circuit.slug,
    titre: circuit.titre,
    resume: circuit.resume,
    description: circuit.description,
    difficulte: circuit.difficulte,
    dureeJours: circuit.dureeJours,
    distanceKm: roundKm(circuit.trace?.distanceKm ?? circuit.distanceKm),
    capaciteMax: circuit.capaciteMax,
    ...photo(circuit.imagePrincipaleUrl),
    prixMin: circuit.prixMin,
    note: circuit.note,
    etapes: circuit.etapes.map((s) => ({
      ordre: s.ordre,
      jour: s.jour,
      nom: s.etape.nom,
      type: s.etape.type,
      description: s.etape.description,
      latitude: s.etape.latitude,
      longitude: s.etape.longitude,
    })),
    trace: circuit.trace?.path.map((p) => [p.latitude, p.longitude] as const) ?? null,
    partenaires: circuit.partenaires.map((p) => ({
      prestation: p.prestation,
      partenaire: p.partenaire.nom,
      type: p.partenaire.type,
      inclusDansPrix: p.inclusDansPrix,
    })),
    departs: circuit.departs.map(toDepart),
    avis: avis.map((a) => ({
      note: a.note,
      commentaire: a.commentaire,
      auteur: a.auteur,
      date: a.createdAt.toISOString(),
    })),
  };
}

export type CatalogueCircuitDetail = NonNullable<Awaited<ReturnType<typeof getCatalogueCircuit>>>;
