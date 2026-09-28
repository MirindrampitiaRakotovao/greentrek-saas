import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getAgencyDashboard } from "@/lib/dashboard/agency";
import { getClientDashboard } from "@/lib/dashboard/client";
import { getGuideDashboard } from "@/lib/dashboard/guide";
import { getPlatformDashboard } from "@/lib/dashboard/platform";
import { getTenantDb } from "@/lib/tenant";

import { createTestClient, truncateAll } from "./test-db";

/**
 * Tableaux de bord : chaque valeur attendue est calculée à la main sur un petit jeu de
 * données (agence A), et l'agence B ne doit jamais apparaître dans les chiffres de A.
 * « Aujourd'hui » est fixé au lundi 28 septembre 2026, 12 h à Madagascar.
 */
const raw = createTestClient();
const NOW = new Date("2026-09-28T09:00:00Z");

let agenceA: { id: string };
let clientId: string;
let guideUserId: string;

beforeAll(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({ data: { nom: "Agence A", slug: "agence-a" } });
  const agenceB = await raw.agence.create({ data: { nom: "Agence B", slug: "agence-b" } });

  const user = (agenceId: string, role: "CLIENT" | "GUIDE", email: string) =>
    raw.utilisateur.create({
      data: { agenceId, role, email, nom: "Test", prenom: role, motDePasseHash: "x" },
    });
  const client = await user(agenceA.id, "CLIENT", "client@a.test");
  clientId = client.id;
  const guideUser = await user(agenceA.id, "GUIDE", "guide@a.test");
  guideUserId = guideUser.id;
  const guide = await raw.guide.create({
    data: { agenceId: agenceA.id, utilisateurId: guideUser.id, nom: "G", prenom: "G", langues: [] },
  });

  const circuit = await raw.circuit.create({
    data: {
      agenceId: agenceA.id,
      titre: "Circuit A",
      slug: "circuit-a",
      difficulte: "FACILE",
      dureeJours: 1,
      prixParPersonne: 100_000,
      capaciteMax: 10,
      statut: "PUBLIE",
    },
  });
  const session = (dateDebut: string, statut: "OUVERTE" | "TERMINEE", guideId?: string) =>
    raw.sessionDepart.create({
      data: {
        agenceId: agenceA.id,
        circuitId: circuit.id,
        guideId,
        dateDebut: new Date(dateDebut),
        dateFin: new Date(dateDebut),
        placesTotal: 10,
        statut,
      },
    });
  const future = await session("2026-10-08", "OUVERTE", guide.id);
  const past = await session("2026-08-15", "TERMINEE");

  const reservation = (
    reference: string,
    sessionId: string,
    personnes: number,
    statut: "EN_ATTENTE" | "CONFIRMEE" | "ANNULEE" | "TERMINEE",
    createdAt: string,
  ) =>
    raw.reservation.create({
      data: {
        agenceId: agenceA.id,
        reference,
        clientId: client.id,
        sessionId,
        nombrePersonnes: personnes,
        montantTotal: personnes * 100_000,
        statut,
        createdAt: new Date(createdAt),
      },
    });
  const r1 = await reservation("A-1", future.id, 2, "CONFIRMEE", "2026-09-05T08:00:00Z");
  await reservation("A-2", future.id, 3, "EN_ATTENTE", "2026-09-20T08:00:00Z");
  await reservation("A-3", future.id, 1, "ANNULEE", "2026-09-21T08:00:00Z");
  const r4 = await reservation("A-4", past.id, 4, "TERMINEE", "2026-08-10T08:00:00Z");
  await raw.paiement.createMany({
    data: [
      {
        reservationId: r1.id,
        montant: 60_000,
        methode: "ESPECES",
        statut: "VALIDE",
        payeLe: new Date("2026-09-06T08:00:00Z"),
      },
      {
        reservationId: r4.id,
        montant: 400_000,
        methode: "VIREMENT",
        statut: "VALIDE",
        payeLe: new Date("2026-08-11T08:00:00Z"),
      },
    ],
  });

  // Agence B : une réservation ce mois-ci, qui ne doit jamais compter pour A.
  const clientB = await user(agenceB.id, "CLIENT", "client@b.test");
  const circuitB = await raw.circuit.create({
    data: {
      agenceId: agenceB.id,
      titre: "Circuit B",
      slug: "circuit-b",
      difficulte: "FACILE",
      dureeJours: 1,
      prixParPersonne: 999_000,
      capaciteMax: 10,
    },
  });
  const sessionB = await raw.sessionDepart.create({
    data: {
      agenceId: agenceB.id,
      circuitId: circuitB.id,
      dateDebut: new Date("2026-10-01"),
      dateFin: new Date("2026-10-01"),
      placesTotal: 5,
    },
  });
  await raw.reservation.create({
    data: {
      agenceId: agenceB.id,
      reference: "B-1",
      clientId: clientB.id,
      sessionId: sessionB.id,
      nombrePersonnes: 5,
      montantTotal: 4_995_000,
      statut: "CONFIRMEE",
      createdAt: new Date("2026-09-10T08:00:00Z"),
    },
  });
});

afterAll(async () => {
  await raw.$disconnect();
});

describe("tableau de bord de l'agence", () => {
  it("indicateurs du mois, comparés au mois précédent (annulations exclues)", async () => {
    const d = await getAgencyDashboard(getTenantDb(agenceA.id, raw), agenceA.id, NOW);
    expect(d.kpis.reservations).toEqual({ value: 2, previous: 1, change: 100 });
    expect(d.kpis.montantReserve).toEqual({ value: 500_000, previous: 400_000, change: 25 });
    expect(d.kpis.encaisse).toEqual({ value: 60_000, previous: 400_000, change: -85 });
  });

  it("taux de remplissage des départs à venir : 5 personnes / 10 places", async () => {
    const d = await getAgencyDashboard(getTenantDb(agenceA.id, raw), agenceA.id, NOW);
    expect(d.kpis.remplissage).toEqual({ taux: 50, reservees: 5, places: 10, departs: 1 });
    expect(d.prochainsDeparts[0]).toMatchObject({ reservees: 5, places: 10, guide: "G G" });
  });

  it("graphique, statuts et classement des circuits", async () => {
    const d = await getAgencyDashboard(getTenantDb(agenceA.id, raw), agenceA.id, NOW);
    expect(d.chart["12m"].at(-1)).toMatchObject({
      key: "2026-09",
      reserve: 500_000,
      encaisse: 60_000,
    });
    expect(d.chart["12m"].at(-2)).toMatchObject({
      key: "2026-08",
      reserve: 400_000,
      encaisse: 400_000,
    });
    expect(Object.fromEntries(d.statuts.map((s) => [s.statut, s.count]))).toEqual({
      CONFIRMEE: 1,
      EN_ATTENTE: 1,
      TERMINEE: 1,
      ANNULEE: 1,
    });
    expect(d.topCircuits).toEqual([
      expect.objectContaining({ titre: "Circuit A", reservations: 3, montant: 900_000 }),
    ]);
  });

  it("les données de l'agence B n'apparaissent nulle part", async () => {
    const d = await getAgencyDashboard(getTenantDb(agenceA.id, raw), agenceA.id, NOW);
    expect(d.dernieresReservations.map((r) => r.reference)).not.toContain("B-1");
    expect(d.dernieresReservations).toHaveLength(4);
    expect(d.dernieresReservations[0]!.reference).toBe("A-3"); // la plus récente
    expect(JSON.stringify(d)).not.toContain("Circuit B");
  });
});

describe("tableau de bord du guide", () => {
  it("ne montre que ses départs à venir et ses participants", async () => {
    const d = await getGuideDashboard(getTenantDb(agenceA.id, raw), guideUserId, NOW);
    expect(d).toMatchObject({ aVenir: 1, participantsAttendus: 5, encadres: 0 });
  });
});

describe("tableau de bord du client", () => {
  it("ses voyages, ce qu'il a payé et ce qu'il reste à payer", async () => {
    const d = await getClientDashboard(getTenantDb(agenceA.id, raw), agenceA.id, clientId, NOW);
    expect(d).toMatchObject({ aVenir: 2, termines: 1, totalPaye: 460_000, resteAPayer: 440_000 });
    expect(d.prochain?.circuit).toBe("Circuit A");
  });
});

describe("tableau de bord de la plateforme", () => {
  it("compte les agences et les réservations de toutes les agences", async () => {
    const d = await getPlatformDashboard(raw, NOW);
    expect(d.agences).toEqual({ actives: 2, suspendues: 0 });
    expect(d.reservationsMois).toMatchObject({ value: 3, previous: 1 });
    const ligneA = d.tableau.find((row) => row.slug === "agence-a");
    expect(ligneA).toMatchObject({ reservationsMois: 2, montantMois: 500_000, circuits: 1 });
  });
});
