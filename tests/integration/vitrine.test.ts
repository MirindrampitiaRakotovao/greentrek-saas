import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { parseIsoDate } from "@/lib/departs";
import { findVitrineAgency } from "@/lib/public-agency";
import {
  getBookableDepart,
  getPublicCircuit,
  listPublicPartenaires,
  listUpcomingDeparts,
  searchCircuits,
} from "@/lib/services/vitrine";
import { getTenantDb, type TenantDb } from "@/lib/tenant";
import { parseVitrineSearch } from "@/lib/validators/vitrine";

import { createTestClient, truncateAll } from "./test-db";

/** Site vitrine public (étape E8a) : visibilité (RG 9, RG 19), recherche, isolation. */
const raw = createTestClient();
const NOW = new Date("2026-09-29T09:00:00.000Z");

afterAll(async () => {
  await raw.$disconnect();
});

let agenceA: { id: string };
let agenceB: { id: string };
let dbA: TenantDb;
let dbB: TenantDb;
let client: { id: string };

type Statut = "PUBLIE" | "BROUILLON" | "ARCHIVE";
async function makeCircuit(
  agenceId: string,
  slug: string,
  statut: Statut = "PUBLIE",
  difficulte: "FACILE" | "MOYENNE" | "DIFFICILE" = "FACILE",
) {
  return raw.circuit.create({
    data: {
      agenceId,
      titre: `Circuit ${slug}`,
      slug,
      difficulte,
      dureeJours: 2,
      prixParPersonne: 100_000,
      capaciteMax: 10,
      statut,
    },
  });
}

async function makeDepart(
  agenceId: string,
  circuitId: string,
  debut: string,
  options: {
    places?: number;
    prix?: number;
    statut?: "OUVERTE" | "COMPLETE" | "ANNULEE" | "TERMINEE";
  } = {},
) {
  const dateDebut = parseIsoDate(debut);
  return raw.sessionDepart.create({
    data: {
      agenceId,
      circuitId,
      dateDebut,
      dateFin: new Date(dateDebut.getTime() + 86_400_000),
      placesTotal: options.places ?? 8,
      prixParPersonne: options.prix ?? null,
      statut: options.statut ?? "OUVERTE",
      notes: "Note interne",
    },
  });
}

let refCounter = 0;
async function reserve(
  sessionId: string,
  nombrePersonnes: number,
  statut: "CONFIRMEE" | "ANNULEE" = "CONFIRMEE",
) {
  refCounter += 1;
  return raw.reservation.create({
    data: {
      agenceId: agenceA.id,
      reference: `V-${refCounter}`,
      clientId: client.id,
      sessionId,
      nombrePersonnes,
      montantTotal: nombrePersonnes * 100_000,
      statut,
    },
  });
}

beforeEach(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({ data: { nom: "Agence A", slug: "agence-a" } });
  agenceB = await raw.agence.create({ data: { nom: "Agence B", slug: "agence-b" } });
  dbA = getTenantDb(agenceA.id, raw);
  dbB = getTenantDb(agenceB.id, raw);
  client = await raw.utilisateur.create({
    data: {
      agenceId: agenceA.id,
      nom: "Client",
      prenom: "Test",
      email: "client@a.test",
      motDePasseHash: "x",
      role: "CLIENT",
    },
  });
});

describe("agence du site vitrine (RG 19)", () => {
  it("renvoie l'agence active, et rien pour une agence suspendue ou inconnue", async () => {
    expect((await findVitrineAgency(raw, "agence-a"))?.id).toBe(agenceA.id);
    await raw.agence.update({ where: { id: agenceA.id }, data: { statut: "SUSPENDUE" } });
    expect(await findVitrineAgency(raw, "agence-a")).toBeNull();
    expect(await findVitrineAgency(raw, "inconnue")).toBeNull();
  });
});

describe("visibilité des circuits (RG 9)", () => {
  it("seuls les circuits publiés sont listés et consultables", async () => {
    await makeCircuit(agenceA.id, "publie");
    await makeCircuit(agenceA.id, "brouillon", "BROUILLON");
    await makeCircuit(agenceA.id, "archive", "ARCHIVE");
    const cards = await searchCircuits(dbA, {}, NOW);
    expect(cards.map((c) => c.slug)).toEqual(["publie"]);
    expect(await getPublicCircuit(dbA, "publie", NOW)).not.toBeNull();
    expect(await getPublicCircuit(dbA, "brouillon", NOW)).toBeNull();
    expect(await getPublicCircuit(dbA, "archive", NOW)).toBeNull();
  });

  it("isolation : le site de B ne montre pas les circuits ni les départs de A, même par slug ou identifiant", async () => {
    const c = await makeCircuit(agenceA.id, "circuit-a");
    const d = await makeDepart(agenceA.id, c.id, "2026-10-10");
    expect(await searchCircuits(dbB, {}, NOW)).toEqual([]);
    expect(await getPublicCircuit(dbB, "circuit-a", NOW)).toBeNull();
    expect(await getBookableDepart(dbB, d.id, NOW)).toBeNull();
    expect(await listUpcomingDeparts(dbB, 6, NOW)).toEqual([]);
  });

  it("n'expose ni les notes internes ni le coût des prestations partenaires", async () => {
    const c = await makeCircuit(agenceA.id, "publie");
    const p = await raw.partenaire.create({
      data: { agenceId: agenceA.id, nom: "Piroguiers", type: "TRANSPORT" },
    });
    await raw.circuitPartenaire.create({
      data: { circuitId: c.id, partenaireId: p.id, prestation: "Pirogue", prixUnitaire: 5000 },
    });
    await makeDepart(agenceA.id, c.id, "2026-10-10");
    const detail = await getPublicCircuit(dbA, "publie", NOW);
    expect(JSON.stringify(detail)).not.toContain("Note interne");
    expect(detail?.partenaires[0]).not.toHaveProperty("prixUnitaire");
    expect(detail?.departs[0]).not.toHaveProperty("notes");
  });
});

describe("départs proposés au public", () => {
  it("seulement les départs OUVERTS, non commencés, avec des places libres", async () => {
    const c = await makeCircuit(agenceA.id, "publie");
    const ouvert = await makeDepart(agenceA.id, c.id, "2026-10-10");
    await makeDepart(agenceA.id, c.id, "2026-10-12", { statut: "ANNULEE" });
    await makeDepart(agenceA.id, c.id, "2026-10-14", { statut: "COMPLETE" });
    await makeDepart(agenceA.id, c.id, "2026-09-28"); // déjà commencé
    const plein = await makeDepart(agenceA.id, c.id, "2026-10-20", { places: 3 });
    await reserve(plein.id, 3);
    const partiel = await makeDepart(agenceA.id, c.id, "2026-10-22", { places: 5 });
    await reserve(partiel.id, 2);
    await reserve(partiel.id, 2, "ANNULEE"); // une annulée ne compte pas

    const detail = await getPublicCircuit(dbA, "publie", NOW);
    expect(detail?.departs.map((d) => [d.id, d.placesLibres])).toEqual([
      [ouvert.id, 8],
      [partiel.id, 3],
    ]);
    expect(await getBookableDepart(dbA, plein.id, NOW)).toBeNull();
    expect((await getBookableDepart(dbA, ouvert.id, NOW))?.circuit.slug).toBe("publie");
  });

  it("un départ d'un circuit repassé en brouillon n'est plus proposé", async () => {
    const c = await makeCircuit(agenceA.id, "c", "BROUILLON");
    const d = await makeDepart(agenceA.id, c.id, "2026-10-10");
    expect(await getBookableDepart(dbA, d.id, NOW)).toBeNull();
    expect(await listUpcomingDeparts(dbA, 6, NOW)).toEqual([]);
  });

  it("prix « à partir de » : le plus bas des départs, prix spécifique compris", async () => {
    const c = await makeCircuit(agenceA.id, "c");
    await makeDepart(agenceA.id, c.id, "2026-10-10");
    await makeDepart(agenceA.id, c.id, "2026-11-10", { prix: 80_000 });
    const [card] = await searchCircuits(dbA, {}, NOW);
    expect(card?.prixMin).toBe(80_000);
  });

  it("prochains départs, tous circuits confondus, du plus proche au plus lointain", async () => {
    const c1 = await makeCircuit(agenceA.id, "c1");
    const c2 = await makeCircuit(agenceA.id, "c2");
    await makeDepart(agenceA.id, c1.id, "2026-11-01");
    await makeDepart(agenceA.id, c2.id, "2026-10-05");
    const upcoming = await listUpcomingDeparts(dbA, 6, NOW);
    expect(upcoming.map((d) => d.circuit.slug)).toEqual(["c2", "c1"]);
  });
});

describe("recherche (§7.1 : date, voyageurs, difficulté)", () => {
  async function setup() {
    const facile = await makeCircuit(agenceA.id, "facile", "PUBLIE", "FACILE");
    const difficile = await makeCircuit(agenceA.id, "difficile", "PUBLIE", "DIFFICILE");
    await makeCircuit(agenceA.id, "sans-depart", "PUBLIE", "FACILE");
    await makeDepart(agenceA.id, facile.id, "2026-10-10", { places: 4 });
    await makeDepart(agenceA.id, difficile.id, "2026-11-15", { places: 10 });
  }

  it("sans critère : tous les circuits publiés, ceux qui ont un départ d'abord", async () => {
    await setup();
    const cards = await searchCircuits(dbA, {}, NOW);
    expect(cards.map((c) => c.slug)).toEqual(["facile", "difficile", "sans-depart"]);
  });

  it("par difficulté", async () => {
    await setup();
    const cards = await searchCircuits(dbA, { difficulte: "FACILE" }, NOW);
    expect(cards.map((c) => c.slug)).toEqual(["facile", "sans-depart"]);
  });

  it("par date : départs à partir de cette date seulement", async () => {
    await setup();
    const cards = await searchCircuits(dbA, { date: "2026-11-01" }, NOW);
    expect(cards.map((c) => c.slug)).toEqual(["difficile"]);
  });

  it("une date passée est ramenée à aujourd'hui", async () => {
    await setup();
    const cards = await searchCircuits(dbA, { date: "2026-01-01" }, NOW);
    expect(cards.map((c) => c.slug)).toEqual(["facile", "difficile"]);
  });

  it("par nombre de voyageurs : assez de places libres sur le départ", async () => {
    await setup();
    expect((await searchCircuits(dbA, { voyageurs: 5 }, NOW)).map((c) => c.slug)).toEqual([
      "difficile",
    ]);
    expect(await searchCircuits(dbA, { voyageurs: 11 }, NOW)).toEqual([]);
  });

  it("critères combinés", async () => {
    await setup();
    const cards = await searchCircuits(
      dbA,
      { date: "2026-10-01", voyageurs: 4, difficulte: "FACILE" },
      NOW,
    );
    expect(cards.map((c) => c.slug)).toEqual(["facile"]);
  });

  it("les paramètres d'URL invalides sont ignorés", () => {
    expect(
      parseVitrineSearch({ date: "2026-02-30", voyageurs: "abc", difficulte: "EXTREME" }),
    ).toEqual({ date: undefined, voyageurs: undefined, difficulte: undefined });
    expect(parseVitrineSearch({ date: "2026-10-01", voyageurs: ["3", "9"] })).toEqual({
      date: "2026-10-01",
      voyageurs: 3,
      difficulte: undefined,
    });
  });
});

describe("partenaires", () => {
  it("seuls les partenaires actifs de l'agence sont présentés", async () => {
    await raw.partenaire.createMany({
      data: [
        { agenceId: agenceA.id, nom: "Actif", type: "HEBERGEMENT" },
        { agenceId: agenceA.id, nom: "Inactif", type: "HEBERGEMENT", actif: false },
        { agenceId: agenceB.id, nom: "Autre agence", type: "HEBERGEMENT" },
      ],
    });
    expect((await listPublicPartenaires(dbA)).map((p) => p.nom)).toEqual(["Actif"]);
  });
});
