import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { getTenantDb, TenantViolationError, type TenantDb } from "@/lib/tenant";

import { createTestClient, truncateAll } from "./test-db";

/**
 * Tests d'isolation multi-tenant (cahier des charges §4, RG 20).
 *
 * Deux agences A et B possèdent chacune un jeu complet de données. On utilise le client
 * confiné à l'agence A et on vérifie qu'il ne peut ni lire, ni modifier, ni supprimer,
 * ni référencer une donnée de B : par identifiant direct, par liste et par relation.
 * Toutes les données sont fictives ; les coordonnées sont des valeurs de test.
 */
const raw = createTestClient();

afterAll(async () => {
  await raw.$disconnect();
});

type Fixture = Awaited<ReturnType<typeof createAgencyData>>;

async function createAgencyData(client: PrismaClient, slug: string) {
  const agence = await client.agence.create({ data: { nom: `Agence ${slug}`, slug } });
  const agenceId = agence.id;
  const admin = await client.utilisateur.create({
    data: {
      agenceId,
      nom: "Test",
      prenom: "Admin",
      email: `admin@${slug}.test`,
      motDePasseHash: "x",
      role: "ADMIN_AGENCE",
    },
  });
  const clientUser = await client.utilisateur.create({
    data: {
      agenceId,
      nom: "Test",
      prenom: "Client",
      email: `client@${slug}.test`,
      motDePasseHash: "x",
      role: "CLIENT",
    },
  });
  const etape1 = await client.etape.create({
    data: { agenceId, nom: `${slug} 1`, type: "VILLAGE", latitude: 0, longitude: 0 },
  });
  const etape2 = await client.etape.create({
    data: { agenceId, nom: `${slug} 2`, type: "VILLAGE", latitude: 0.01, longitude: 0.01 },
  });
  const troncon = await client.troncon.create({
    data: {
      agenceId,
      etapeDepartId: etape1.id,
      etapeArriveeId: etape2.id,
      distanceKm: 2,
      dureeMinutes: 40,
      difficulte: 2,
    },
  });
  const circuit = await client.circuit.create({
    data: {
      agenceId,
      titre: `Circuit ${slug}`,
      slug: "circuit",
      difficulte: "FACILE",
      dureeJours: 1,
      prixParPersonne: 50_000,
      capaciteMax: 8,
    },
  });
  const circuitEtape = await client.circuitEtape.create({
    data: { circuitId: circuit.id, etapeId: etape1.id, ordre: 1 },
  });
  const partenaire = await client.partenaire.create({
    data: { agenceId, nom: `Partenaire ${slug}`, type: "HEBERGEMENT" },
  });
  const guide = await client.guide.create({
    data: { agenceId, nom: "Test", prenom: "Guide", langues: ["fr"] },
  });
  const session = await client.sessionDepart.create({
    data: {
      agenceId,
      circuitId: circuit.id,
      guideId: guide.id,
      dateDebut: new Date("2026-11-10"),
      dateFin: new Date("2026-11-10"),
      placesTotal: 8,
    },
  });
  const reservation = await client.reservation.create({
    data: {
      agenceId,
      reference: `${slug.toUpperCase()}-0001`,
      clientId: clientUser.id,
      sessionId: session.id,
      nombrePersonnes: 2,
      montantTotal: 100_000,
    },
  });
  const participant = await client.participant.create({
    data: { reservationId: reservation.id, nom: "Test", prenom: "Participant" },
  });
  const paiement = await client.paiement.create({
    data: { reservationId: reservation.id, montant: 50_000, methode: "ESPECES" },
  });
  return {
    agence,
    admin,
    clientUser,
    etape1,
    etape2,
    troncon,
    circuit,
    circuitEtape,
    partenaire,
    guide,
    session,
    reservation,
    participant,
    paiement,
  };
}

let a: Fixture;
let b: Fixture;
let tenantA: TenantDb;

beforeEach(async () => {
  await truncateAll(raw);
  a = await createAgencyData(raw, "agence-a");
  b = await createAgencyData(raw, "agence-b");
  tenantA = getTenantDb(a.agence.id, raw);
});

describe("lecture par identifiant direct", () => {
  it("findUnique sur un circuit de B renvoie null", async () => {
    await expect(tenantA.circuit.findUnique({ where: { id: b.circuit.id } })).resolves.toBeNull();
  });

  it("findUnique sur une donnée de A la renvoie normalement", async () => {
    const circuit = await tenantA.circuit.findUnique({ where: { id: a.circuit.id } });
    expect(circuit?.id).toBe(a.circuit.id);
  });

  it("findFirst avec l'identifiant de B renvoie null", async () => {
    await expect(tenantA.etape.findFirst({ where: { id: b.etape1.id } })).resolves.toBeNull();
  });

  it("findUniqueOrThrow sur une réservation de B lève une erreur", async () => {
    await expect(
      tenantA.reservation.findUniqueOrThrow({ where: { id: b.reservation.id } }),
    ).rejects.toThrow();
  });

  it("un filtre explicite agenceId = B est neutralisé", async () => {
    await expect(
      tenantA.circuit.findMany({ where: { agenceId: b.agence.id } }),
    ).resolves.toHaveLength(0);
  });

  it("tables de liaison : participant et paiement de B introuvables", async () => {
    await expect(
      tenantA.participant.findUnique({ where: { id: b.participant.id } }),
    ).resolves.toBeNull();
    await expect(tenantA.paiement.findUnique({ where: { id: b.paiement.id } })).resolves.toBeNull();
    await expect(
      tenantA.circuitEtape.findUnique({ where: { id: b.circuitEtape.id } }),
    ).resolves.toBeNull();
  });

  it("l'agence A ne voit qu'elle-même dans la table Agence", async () => {
    await expect(tenantA.agence.findUnique({ where: { id: b.agence.id } })).resolves.toBeNull();
    const agences = await tenantA.agence.findMany();
    expect(agences.map((x) => x.id)).toEqual([a.agence.id]);
  });
});

describe("lecture par liste et agrégats", () => {
  it("findMany ne renvoie que les données de A, pour chaque table métier", async () => {
    const lists = await Promise.all([
      tenantA.utilisateur.findMany(),
      tenantA.etape.findMany(),
      tenantA.troncon.findMany(),
      tenantA.circuit.findMany(),
      tenantA.partenaire.findMany(),
      tenantA.guide.findMany(),
      tenantA.sessionDepart.findMany(),
      tenantA.reservation.findMany(),
    ]);
    for (const rows of lists) {
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.agenceId === a.agence.id)).toBe(true);
    }
  });

  it("tables de liaison : seules les lignes dont le parent est dans A", async () => {
    const participants = await tenantA.participant.findMany();
    const paiements = await tenantA.paiement.findMany();
    const circuitEtapes = await tenantA.circuitEtape.findMany();
    expect(participants.map((p) => p.id)).toEqual([a.participant.id]);
    expect(paiements.map((p) => p.id)).toEqual([a.paiement.id]);
    expect(circuitEtapes.map((c) => c.id)).toEqual([a.circuitEtape.id]);
  });

  it("count, aggregate et groupBy ne comptent que A", async () => {
    await expect(tenantA.reservation.count()).resolves.toBe(1);
    const sum = await tenantA.reservation.aggregate({ _sum: { montantTotal: true } });
    expect(sum._sum.montantTotal).toBe(100_000);
    const groups = await tenantA.utilisateur.groupBy({ by: ["role"], _count: true });
    expect(groups.reduce((total, g) => total + g._count, 0)).toBe(2);
  });

  it("le super admin (agenceId null) n'apparaît pas dans les utilisateurs de A", async () => {
    await raw.utilisateur.create({
      data: {
        agenceId: null,
        nom: "Test",
        prenom: "Super",
        email: "super@test.test",
        motDePasseHash: "x",
        role: "SUPER_ADMIN",
      },
    });
    const users = await tenantA.utilisateur.findMany();
    expect(users.some((u) => u.role === "SUPER_ADMIN")).toBe(false);
  });

  it("une transaction interactive reste confinée à A", async () => {
    const circuits = await tenantA.$tenantTransaction((tx) => tx.circuit.findMany());
    expect(circuits.map((c) => c.id)).toEqual([a.circuit.id]);
  });
});

describe("lecture par relation", () => {
  it("include depuis une donnée de A ne ramène que des données de A", async () => {
    const circuit = await tenantA.circuit.findUnique({
      where: { id: a.circuit.id },
      include: { sessionsDepart: { include: { reservations: true } }, etapes: true },
    });
    expect(circuit?.sessionsDepart.map((s) => s.id)).toEqual([a.session.id]);
    expect(circuit?.sessionsDepart[0]?.reservations.map((r) => r.id)).toEqual([a.reservation.id]);
    expect(circuit?.etapes.map((e) => e.id)).toEqual([a.circuitEtape.id]);
  });

  it("un filtre relationnel vers B ne renvoie rien", async () => {
    await expect(
      tenantA.reservation.findMany({ where: { sessionId: b.session.id } }),
    ).resolves.toHaveLength(0);
  });
});

describe("modification", () => {
  it("update d'un circuit de B échoue et B reste inchangé", async () => {
    await expect(
      tenantA.circuit.update({ where: { id: b.circuit.id }, data: { titre: "Piraté" } }),
    ).rejects.toThrow();
    const circuitB = await raw.circuit.findUniqueOrThrow({ where: { id: b.circuit.id } });
    expect(circuitB.titre).toBe(b.circuit.titre);
  });

  it("updateMany sans filtre ne modifie que A", async () => {
    const result = await tenantA.circuit.updateMany({ data: { statut: "PUBLIE" } });
    expect(result.count).toBe(1);
    const circuitB = await raw.circuit.findUniqueOrThrow({ where: { id: b.circuit.id } });
    expect(circuitB.statut).toBe("BROUILLON");
  });

  it("update d'un paiement de B (table de liaison) échoue", async () => {
    await expect(
      tenantA.paiement.update({ where: { id: b.paiement.id }, data: { statut: "VALIDE" } }),
    ).rejects.toThrow();
  });

  it("déplacer une donnée de A vers B est refusé", async () => {
    await expect(
      tenantA.circuit.update({ where: { id: a.circuit.id }, data: { agenceId: b.agence.id } }),
    ).rejects.toThrow(TenantViolationError);
  });

  it("rattacher un tronçon de A à une étape de B est refusé", async () => {
    await expect(
      tenantA.troncon.update({
        where: { id: a.troncon.id },
        data: { etapeArriveeId: b.etape2.id },
      }),
    ).rejects.toThrow(TenantViolationError);
  });

  it("upsert visant un identifiant de B ne modifie pas B", async () => {
    await tenantA.partenaire.upsert({
      where: { id: b.partenaire.id },
      create: { agenceId: a.agence.id, nom: "Créé par A", type: "ACTIVITE" },
      update: { nom: "Piraté" },
    });
    const partenaireB = await raw.partenaire.findUniqueOrThrow({ where: { id: b.partenaire.id } });
    expect(partenaireB.nom).toBe(b.partenaire.nom);
    // L'identifiant de B étant invisible pour A, l'upsert a créé une nouvelle ligne dans A.
    await expect(
      raw.partenaire.count({ where: { nom: "Créé par A", agenceId: a.agence.id } }),
    ).resolves.toBe(1);
  });

  it("l'agence A ne peut pas modifier l'agence B", async () => {
    await expect(
      tenantA.agence.update({ where: { id: b.agence.id }, data: { nom: "Piraté" } }),
    ).rejects.toThrow();
  });
});

describe("suppression", () => {
  it("delete d'un partenaire de B échoue et B existe toujours", async () => {
    await expect(tenantA.partenaire.delete({ where: { id: b.partenaire.id } })).rejects.toThrow();
    await expect(raw.partenaire.count({ where: { id: b.partenaire.id } })).resolves.toBe(1);
  });

  it("deleteMany sans filtre ne supprime que A", async () => {
    const result = await tenantA.participant.deleteMany();
    expect(result.count).toBe(1);
    await expect(raw.participant.count({ where: { id: b.participant.id } })).resolves.toBe(1);
  });

  it("supprimer une agence est réservé au super admin", async () => {
    await expect(tenantA.agence.delete({ where: { id: a.agence.id } })).rejects.toThrow(
      TenantViolationError,
    );
  });
});

describe("création et références", () => {
  // Le code applicatif passe agenceId explicitement (typage strict) ; ici on l'omet
  // volontairement (`as never`) pour prouver que le helper l'injecte.
  it("une création sans agenceId est rattachée à A", async () => {
    const partenaire = await tenantA.partenaire.create({
      data: { nom: "Nouveau", type: "RESTAURATION" } as never,
    });
    expect(partenaire.agenceId).toBe(a.agence.id);
  });

  it("une création avec agenceId = B est refusée", async () => {
    await expect(
      tenantA.partenaire.create({
        data: { agenceId: b.agence.id, nom: "Intrus", type: "RESTAURATION" },
      }),
    ).rejects.toThrow(TenantViolationError);
    await expect(raw.partenaire.count({ where: { nom: "Intrus" } })).resolves.toBe(0);
  });

  it("createMany rattache toutes les lignes à A", async () => {
    await tenantA.partenaire.createMany({
      data: [
        { nom: "P1", type: "ACTIVITE" },
        { nom: "P2", type: "TRANSPORT" },
      ] as never,
    });
    const created = await raw.partenaire.findMany({ where: { nom: { in: ["P1", "P2"] } } });
    expect(created.every((p) => p.agenceId === a.agence.id)).toBe(true);
  });

  it("RG 6 : un tronçon de A vers une étape de B est refusé", async () => {
    await expect(
      tenantA.troncon.create({
        data: {
          etapeDepartId: a.etape2.id,
          etapeArriveeId: b.etape1.id,
          distanceKm: 1,
          dureeMinutes: 20,
          difficulte: 1,
        } as never,
      }),
    ).rejects.toThrow(TenantViolationError);
  });

  it("ajouter une étape à un circuit de B est refusé", async () => {
    await expect(
      tenantA.circuitEtape.create({
        data: { circuitId: b.circuit.id, etapeId: a.etape2.id, ordre: 2 },
      }),
    ).rejects.toThrow(TenantViolationError);
  });

  it("ajouter une étape de B à un circuit de A est refusé", async () => {
    await expect(
      tenantA.circuitEtape.create({
        data: { circuitId: a.circuit.id, etapeId: b.etape2.id, ordre: 2 },
      }),
    ).rejects.toThrow(TenantViolationError);
  });

  it("enregistrer un paiement sur une réservation de B est refusé", async () => {
    await expect(
      tenantA.paiement.create({
        data: { reservationId: b.reservation.id, montant: 1_000, methode: "ESPECES" },
      }),
    ).rejects.toThrow(TenantViolationError);
  });

  it("réserver un départ de B, ou pour un client de B, est refusé", async () => {
    const base = { reference: "A-9999", nombrePersonnes: 1, montantTotal: 50_000 };
    await expect(
      tenantA.reservation.create({
        data: { ...base, clientId: a.clientUser.id, sessionId: b.session.id } as never,
      }),
    ).rejects.toThrow(TenantViolationError);
    await expect(
      tenantA.reservation.create({
        data: { ...base, clientId: b.clientUser.id, sessionId: a.session.id } as never,
      }),
    ).rejects.toThrow(TenantViolationError);
  });

  it("affecter un guide de B à un départ de A est refusé", async () => {
    await expect(
      tenantA.sessionDepart.update({ where: { id: a.session.id }, data: { guideId: b.guide.id } }),
    ).rejects.toThrow(TenantViolationError);
  });

  it("les écritures imbriquées (connect) sont interdites", async () => {
    await expect(
      tenantA.circuitEtape.create({
        data: {
          circuit: { connect: { id: b.circuit.id } },
          etape: { connect: { id: a.etape1.id } },
          ordre: 3,
        },
      }),
    ).rejects.toThrow(TenantViolationError);
  });

  it("les plans sont en lecture seule pour une agence", async () => {
    await expect(
      tenantA.plan.create({
        data: {
          code: "PIRATE",
          nom: "Pirate",
          prixMensuel: 0,
          maxCircuits: 1,
          maxUtilisateurs: 1,
          maxSessionsActives: 1,
          fonctionnalites: [],
        },
      }),
    ).rejects.toThrow(TenantViolationError);
  });
});

describe("transactions ($tenantTransaction)", () => {
  it("une création peut référencer une ligne créée juste avant dans la même transaction", async () => {
    const troncon = await tenantA.$tenantTransaction(async (tx) => {
      const etape = await tx.etape.create({
        data: {
          agenceId: a.agence.id,
          nom: "Nouvelle",
          type: "AUTRE",
          latitude: 0,
          longitude: 0.02,
        },
      });
      return tx.troncon.create({
        data: {
          agenceId: a.agence.id,
          etapeDepartId: a.etape2.id,
          etapeArriveeId: etape.id,
          distanceKm: 1,
          dureeMinutes: 15,
          difficulte: 1,
        },
      });
    });
    expect(troncon.agenceId).toBe(a.agence.id);
  });

  it("une référence vers B reste refusée, et toute la transaction est annulée", async () => {
    await expect(
      tenantA.$tenantTransaction(async (tx) => {
        await tx.partenaire.create({
          data: { agenceId: a.agence.id, nom: "Annulé", type: "ACTIVITE" },
        });
        await tx.troncon.create({
          data: {
            agenceId: a.agence.id,
            etapeDepartId: a.etape1.id,
            etapeArriveeId: b.etape2.id,
            distanceKm: 1,
            dureeMinutes: 15,
            difficulte: 1,
          },
        });
      }),
    ).rejects.toThrow(TenantViolationError);
    await expect(raw.partenaire.count({ where: { nom: "Annulé" } })).resolves.toBe(0);
  });
});
