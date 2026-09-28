import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, truncateAll } from "./test-db";

/**
 * Règles de gestion garanties par la base elle-même (contraintes CHECK, index uniques,
 * clés étrangères). Ces tests prouvent la « seconde ligne de défense » : même si la
 * validation Zod était contournée, MySQL refuserait la donnée.
 * Les coordonnées ci-dessous sont des valeurs de test, pas des relevés terrain.
 */
const db = createTestClient();

beforeEach(async () => {
  await truncateAll(db);
});

afterAll(async () => {
  await db.$disconnect();
});

async function createAgence(slug: string) {
  return db.agence.create({ data: { nom: `Agence ${slug}`, slug } });
}

async function createGraphe() {
  const agence = await createAgence("agence-a");
  const etapeA = await db.etape.create({
    data: { agenceId: agence.id, nom: "Nœud A", type: "VILLAGE", latitude: 0, longitude: 0 },
  });
  const etapeB = await db.etape.create({
    data: { agenceId: agence.id, nom: "Nœud B", type: "VILLAGE", latitude: 0.01, longitude: 0.01 },
  });
  return { agence, etapeA, etapeB };
}

async function createCircuit(agenceId: string) {
  return db.circuit.create({
    data: {
      agenceId,
      titre: "Circuit de test",
      slug: "circuit-test",
      difficulte: "FACILE",
      dureeJours: 2,
      prixParPersonne: 100_000,
      capaciteMax: 10,
    },
  });
}

describe("Agence et Utilisateur", () => {
  it("RG 1 : refuse deux agences avec le même slug", async () => {
    await createAgence("meme-slug");
    await expect(createAgence("meme-slug")).rejects.toThrow(/Unique constraint/);
  });

  it("RG 3 : refuse deux utilisateurs avec le même e-mail dans une agence", async () => {
    const agence = await createAgence("agence-a");
    const data = {
      agenceId: agence.id,
      nom: "Test",
      prenom: "Client",
      email: "client@exemple.test",
      motDePasseHash: "x",
      role: "CLIENT" as const,
    };
    await db.utilisateur.create({ data });
    await expect(db.utilisateur.create({ data })).rejects.toThrow(/Unique constraint/);
  });

  it("RG 3 : accepte le même e-mail dans deux agences différentes", async () => {
    const a = await createAgence("agence-a");
    const b = await createAgence("agence-b");
    const base = {
      nom: "Test",
      prenom: "Client",
      email: "client@exemple.test",
      motDePasseHash: "x",
      role: "CLIENT" as const,
    };
    await db.utilisateur.create({ data: { ...base, agenceId: a.id } });
    await expect(
      db.utilisateur.create({ data: { ...base, agenceId: b.id } }),
    ).resolves.toBeDefined();
  });
});

describe("Etape", () => {
  it("refuse une latitude hors de [-90, 90]", async () => {
    const agence = await createAgence("agence-a");
    await expect(
      db.etape.create({
        data: { agenceId: agence.id, nom: "X", type: "AUTRE", latitude: 91, longitude: 0 },
      }),
    ).rejects.toThrow(/Etape_latitude_check/);
  });
});

describe("Troncon (arête du graphe)", () => {
  const valide = { distanceKm: 3.5, dureeMinutes: 60, difficulte: 2 };

  it("accepte un tronçon valide", async () => {
    const { agence, etapeA, etapeB } = await createGraphe();
    await expect(
      db.troncon.create({
        data: {
          ...valide,
          agenceId: agence.id,
          etapeDepartId: etapeA.id,
          etapeArriveeId: etapeB.id,
        },
      }),
    ).resolves.toBeDefined();
  });

  it("RG 6 : refuse un tronçon d'une étape vers elle-même", async () => {
    const { agence, etapeA } = await createGraphe();
    await expect(
      db.troncon.create({
        data: {
          ...valide,
          agenceId: agence.id,
          etapeDepartId: etapeA.id,
          etapeArriveeId: etapeA.id,
        },
      }),
    ).rejects.toThrow(/Troncon_etapes_distinctes_check/);
  });

  it.each([0, -2])("RG 6 : refuse une distance de %s km", async (distanceKm) => {
    const { agence, etapeA, etapeB } = await createGraphe();
    await expect(
      db.troncon.create({
        data: {
          ...valide,
          distanceKm,
          agenceId: agence.id,
          etapeDepartId: etapeA.id,
          etapeArriveeId: etapeB.id,
        },
      }),
    ).rejects.toThrow(/Troncon_distanceKm_check/);
  });

  it("refuse une durée nulle (le poids d'une arête doit être > 0)", async () => {
    const { agence, etapeA, etapeB } = await createGraphe();
    await expect(
      db.troncon.create({
        data: {
          ...valide,
          dureeMinutes: 0,
          agenceId: agence.id,
          etapeDepartId: etapeA.id,
          etapeArriveeId: etapeB.id,
        },
      }),
    ).rejects.toThrow(/Troncon_dureeMinutes_check/);
  });

  it.each([0, 6])("refuse une difficulté de %s (attendu : 1 à 5)", async (difficulte) => {
    const { agence, etapeA, etapeB } = await createGraphe();
    await expect(
      db.troncon.create({
        data: {
          ...valide,
          difficulte,
          agenceId: agence.id,
          etapeDepartId: etapeA.id,
          etapeArriveeId: etapeB.id,
        },
      }),
    ).rejects.toThrow(/Troncon_difficulte_check/);
  });

  it("RG 7 : refuse un second tronçon pour le même couple (départ, arrivée)", async () => {
    const { agence, etapeA, etapeB } = await createGraphe();
    const data = {
      ...valide,
      agenceId: agence.id,
      etapeDepartId: etapeA.id,
      etapeArriveeId: etapeB.id,
    };
    await db.troncon.create({ data });
    await expect(db.troncon.create({ data })).rejects.toThrow(/Unique constraint/);
  });

  it("RG 8 : refuse la suppression d'une étape reliée par un tronçon", async () => {
    const { agence, etapeA, etapeB } = await createGraphe();
    await db.troncon.create({
      data: { ...valide, agenceId: agence.id, etapeDepartId: etapeA.id, etapeArriveeId: etapeB.id },
    });
    await expect(db.etape.delete({ where: { id: etapeA.id } })).rejects.toThrow();
    await expect(db.etape.count()).resolves.toBe(2);
  });
});

describe("Circuit et CircuitEtape", () => {
  it("RG 4 : refuse deux étapes au même rang dans un circuit", async () => {
    const { agence, etapeA, etapeB } = await createGraphe();
    const circuit = await createCircuit(agence.id);
    await db.circuitEtape.create({ data: { circuitId: circuit.id, etapeId: etapeA.id, ordre: 1 } });
    await expect(
      db.circuitEtape.create({ data: { circuitId: circuit.id, etapeId: etapeB.id, ordre: 1 } }),
    ).rejects.toThrow(/Unique constraint/);
  });

  it("RG 8 : refuse la suppression d'une étape utilisée par un circuit", async () => {
    const { agence, etapeA } = await createGraphe();
    const circuit = await createCircuit(agence.id);
    await db.circuitEtape.create({ data: { circuitId: circuit.id, etapeId: etapeA.id, ordre: 1 } });
    await expect(db.etape.delete({ where: { id: etapeA.id } })).rejects.toThrow();
  });

  it("supprimer un circuit supprime ses liaisons CircuitEtape, pas les étapes", async () => {
    const { agence, etapeA } = await createGraphe();
    const circuit = await createCircuit(agence.id);
    await db.circuitEtape.create({ data: { circuitId: circuit.id, etapeId: etapeA.id, ordre: 1 } });
    await db.circuit.delete({ where: { id: circuit.id } });
    await expect(db.circuitEtape.count()).resolves.toBe(0);
    await expect(db.etape.count()).resolves.toBe(2);
  });
});

describe("SessionDepart et Reservation", () => {
  async function createSession(overrides: { dateFin?: Date; placesTotal?: number } = {}) {
    const agence = await createAgence("agence-a");
    const circuit = await createCircuit(agence.id);
    return db.sessionDepart.create({
      data: {
        agenceId: agence.id,
        circuitId: circuit.id,
        dateDebut: new Date("2026-11-10"),
        dateFin: overrides.dateFin ?? new Date("2026-11-12"),
        placesTotal: overrides.placesTotal ?? 8,
      },
    });
  }

  it("RG 10 : refuse une date de fin antérieure à la date de début", async () => {
    await expect(createSession({ dateFin: new Date("2026-11-09") })).rejects.toThrow(
      /SessionDepart_dates_check/,
    );
  });

  it("accepte un départ d'une seule journée (fin = début)", async () => {
    await expect(createSession({ dateFin: new Date("2026-11-10") })).resolves.toBeDefined();
  });

  it("refuse un départ sans place", async () => {
    await expect(createSession({ placesTotal: 0 })).rejects.toThrow(
      /SessionDepart_placesTotal_check/,
    );
  });

  it("RG 12 : refuse une réservation pour zéro personne", async () => {
    const session = await createSession();
    const client = await db.utilisateur.create({
      data: {
        agenceId: session.agenceId,
        nom: "Test",
        prenom: "Client",
        email: "client@exemple.test",
        motDePasseHash: "x",
        role: "CLIENT",
      },
    });
    await expect(
      db.reservation.create({
        data: {
          agenceId: session.agenceId,
          reference: "TEST-000001",
          clientId: client.id,
          sessionId: session.id,
          nombrePersonnes: 0,
          montantTotal: 0,
        },
      }),
    ).rejects.toThrow(/Reservation_nombrePersonnes_check/);
  });
});
