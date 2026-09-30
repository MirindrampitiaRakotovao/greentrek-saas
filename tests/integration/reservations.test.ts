import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { parseIsoDate } from "@/lib/departs";
import { registerClient } from "@/lib/services/clients";
import {
  cancelReservationByClient,
  createReservation,
  getClientReservation,
  listClientReservations,
  payReservation,
} from "@/lib/services/reservations";
import { getTenantDb, type TenantDb } from "@/lib/tenant";
import type { ParticipantInput } from "@/lib/validators/reservations";

import { createTestClient, truncateAll } from "./test-db";

/** Réservation client et paiement simulé (étape E9). Date « du jour » fixée. */
const raw = createTestClient();
const NOW = new Date("2026-09-29T09:00:00.000Z");

afterAll(async () => {
  await raw.$disconnect();
});

let agenceA: { id: string; slug: string };
let agenceB: { id: string; slug: string };
let dbA: TenantDb;
let dbB: TenantDb;
let circuitId: string;
let client1: string;
let client2: string;

async function makeClient(agenceId: string, email: string) {
  const u = await raw.utilisateur.create({
    data: { agenceId, nom: "Client", prenom: email, email, motDePasseHash: "x", role: "CLIENT" },
  });
  return u.id;
}

async function makeDepart(
  debut: string,
  places: number,
  options: { statut?: "OUVERTE" | "ANNULEE"; prix?: number } = {},
) {
  const dateDebut = parseIsoDate(debut);
  const s = await raw.sessionDepart.create({
    data: {
      agenceId: agenceA.id,
      circuitId,
      dateDebut,
      dateFin: new Date(dateDebut.getTime() + 86_400_000),
      placesTotal: places,
      prixParPersonne: options.prix ?? null,
      statut: options.statut ?? "OUVERTE",
    },
  });
  return s.id;
}

const personne = (prenom: string): ParticipantInput => ({
  prenom,
  nom: "Test",
  age: 30,
  nationalite: null,
  contactUrgence: null,
});
const personnes = (n: number) => Array.from({ length: n }, (_, i) => personne(`P${i + 1}`));

const reserve = (sessionId: string, n: number, clientId = client1, db = dbA, agence = agenceA) =>
  createReservation(
    db,
    {
      sessionId,
      participants: personnes(n),
      remarques: null,
      agenceId: agence.id,
      agenceSlug: agence.slug,
      clientId,
    },
    NOW,
  );

function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

const sessionStatut = async (id: string) =>
  (await raw.sessionDepart.findUniqueOrThrow({ where: { id } })).statut;

beforeEach(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({ data: { nom: "Green Trek Mada", slug: "green-trek-mada" } });
  agenceB = await raw.agence.create({ data: { nom: "Agence B", slug: "agence-b" } });
  dbA = getTenantDb(agenceA.id, raw);
  dbB = getTenantDb(agenceB.id, raw);
  circuitId = (
    await raw.circuit.create({
      data: {
        agenceId: agenceA.id,
        titre: "Circuit",
        slug: "circuit",
        difficulte: "FACILE",
        dureeJours: 2,
        prixParPersonne: 100_000,
        capaciteMax: 20,
        statut: "PUBLIE",
      },
    })
  ).id;
  client1 = await makeClient(agenceA.id, "c1@a.test");
  client2 = await makeClient(agenceA.id, "c2@a.test");
});

describe("création d'une réservation", () => {
  it("EN_ATTENTE, un participant par personne, montant = prix × personnes (RG 14), référence lisible", async () => {
    const s = await makeDepart("2026-10-10", 8);
    const { id, reference } = unwrap(await reserve(s, 3));
    expect(reference).toMatch(/^GTM-2026-[A-Z2-9]{6}$/);
    const r = await raw.reservation.findUniqueOrThrow({
      where: { id },
      include: { participants: true },
    });
    expect(r).toMatchObject({ statut: "EN_ATTENTE", nombrePersonnes: 3, montantTotal: 300_000 });
    expect(r.participants).toHaveLength(3);
  });

  it("le prix spécifique du départ s'applique ; le montant reste figé si le prix change", async () => {
    const s = await makeDepart("2026-10-10", 8, { prix: 80_000 });
    const { id } = unwrap(await reserve(s, 2));
    await raw.sessionDepart.update({ where: { id: s }, data: { prixParPersonne: 150_000 } });
    await raw.circuit.update({ where: { id: circuitId }, data: { prixParPersonne: 1 } });
    expect((await raw.reservation.findUniqueOrThrow({ where: { id } })).montantTotal).toBe(160_000);
  });

  it("refuse plus de personnes que de places libres ; COMPLETE quand tout est pris (RG 11, 13)", async () => {
    const s = await makeDepart("2026-10-10", 4);
    unwrap(await reserve(s, 3));
    const refus = await reserve(s, 2);
    expect(refus).toMatchObject({ ok: false, field: "participants" });
    expect(refus.ok ? "" : refus.error).toContain("1 place");
    unwrap(await reserve(s, 1));
    expect(await sessionStatut(s)).toBe("COMPLETE");
    expect((await reserve(s, 1)).ok).toBe(false);
  });

  it("refuse un départ annulé, déjà commencé ou d'un circuit non publié", async () => {
    expect((await reserve(await makeDepart("2026-10-10", 8, { statut: "ANNULEE" }), 1)).ok).toBe(
      false,
    );
    expect((await reserve(await makeDepart("2026-09-29", 8), 1)).ok).toBe(false); // commence aujourd'hui
    const s = await makeDepart("2026-10-10", 8);
    await raw.circuit.update({ where: { id: circuitId }, data: { statut: "BROUILLON" } });
    expect((await reserve(s, 1)).ok).toBe(false);
  });
});

describe("anti-surbooking avec des réservations simultanées (RG 13)", () => {
  it("4 demandes simultanées de 2 places pour 2 places libres : une seule réussit", async () => {
    const s = await makeDepart("2026-10-10", 2);
    const results = await Promise.all([1, 2, 3, 4].map(() => reserve(s, 2)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const total = await raw.reservation.aggregate({
      where: { sessionId: s },
      _sum: { nombrePersonnes: true },
    });
    expect(total._sum.nombrePersonnes).toBe(2);
    expect(await sessionStatut(s)).toBe("COMPLETE");
  });

  it("8 demandes simultanées d'une place pour 5 places : exactement 5 réussissent", async () => {
    const s = await makeDepart("2026-10-10", 5);
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => reserve(s, 1, i % 2 === 0 ? client1 : client2)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    const total = await raw.reservation.aggregate({
      where: { sessionId: s },
      _sum: { nombrePersonnes: true },
    });
    expect(total._sum.nombrePersonnes).toBe(5);
  });
});

describe("paiement simulé (RG 16)", () => {
  it("carte acceptée : paiement VALIDE du montant total, réservation CONFIRMEE", async () => {
    const { id } = unwrap(await reserve(await makeDepart("2026-10-10", 8), 2));
    const result = unwrap(
      await payReservation(
        dbA,
        {
          reservationId: id,
          methode: "CARTE_SIMULEE",
          numero: "4970101010101010",
          clientId: client1,
        },
        NOW,
      ),
    );
    expect(result).toEqual({ statut: "VALIDE", confirmee: true });
    const r = await raw.reservation.findUniqueOrThrow({
      where: { id },
      include: { paiements: true },
    });
    expect(r.statut).toBe("CONFIRMEE");
    expect(r.paiements).toMatchObject([
      { montant: 200_000, statut: "VALIDE", referenceExterne: "•••• 1010" },
    ]);
    // Déjà payée : un second paiement est refusé (la somme ne dépasserait plus le montant).
    expect((await payReservation(dbA, { reservationId: id, methode: "ESPECES" }, NOW)).ok).toBe(
      false,
    );
  });

  it("numéro de test finissant par 0000 : paiement ÉCHOUÉ, réservation toujours payable", async () => {
    const { id } = unwrap(await reserve(await makeDepart("2026-10-10", 8), 1));
    const echec = unwrap(
      await payReservation(
        dbA,
        { reservationId: id, methode: "MOBILE_MONEY", numero: "0341230000" },
        NOW,
      ),
    );
    expect(echec).toEqual({ statut: "ECHOUE", confirmee: false });
    expect((await raw.reservation.findUniqueOrThrow({ where: { id } })).statut).toBe("EN_ATTENTE");
    const ok = unwrap(
      await payReservation(
        dbA,
        { reservationId: id, methode: "MOBILE_MONEY", numero: "0341234567" },
        NOW,
      ),
    );
    expect(ok.confirmee).toBe(true);
  });

  it("virement : paiement EN_ATTENTE (validation par l'agence), pas de second paiement en parallèle", async () => {
    const { id } = unwrap(await reserve(await makeDepart("2026-10-10", 8), 1));
    expect(
      unwrap(await payReservation(dbA, { reservationId: id, methode: "VIREMENT" }, NOW)),
    ).toEqual({ statut: "EN_ATTENTE", confirmee: false });
    expect((await payReservation(dbA, { reservationId: id, methode: "ESPECES" }, NOW)).ok).toBe(
      false,
    );
  });

  it("deux paiements simultanés : un seul est enregistré (somme ≤ montant)", async () => {
    const { id } = unwrap(await reserve(await makeDepart("2026-10-10", 8), 1));
    const pay = () =>
      payReservation(
        dbA,
        { reservationId: id, methode: "CARTE_SIMULEE", numero: "4970101010101010" },
        NOW,
      );
    const results = await Promise.all([pay(), pay(), pay()]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const sum = await raw.paiement.aggregate({
      where: { reservationId: id, statut: "VALIDE" },
      _sum: { montant: true },
    });
    expect(sum._sum.montant).toBe(100_000);
  });

  it("un client ne peut pas payer la réservation d'un autre client", async () => {
    const { id } = unwrap(await reserve(await makeDepart("2026-10-10", 8), 1, client1));
    const result = await payReservation(
      dbA,
      { reservationId: id, methode: "VIREMENT", clientId: client2 },
      NOW,
    );
    expect(result.ok).toBe(false);
  });
});

describe("annulation par le client (RG 15)", () => {
  it("avant le départ : ANNULEE, places libérées, départ rouvert, paiement en attente abandonné", async () => {
    const s = await makeDepart("2026-10-10", 2);
    const { id } = unwrap(await reserve(s, 2));
    unwrap(await payReservation(dbA, { reservationId: id, methode: "VIREMENT" }, NOW));
    expect(await sessionStatut(s)).toBe("COMPLETE");
    unwrap(await cancelReservationByClient(dbA, { reservationId: id, clientId: client1 }, NOW));
    const r = await raw.reservation.findUniqueOrThrow({
      where: { id },
      include: { paiements: true },
    });
    expect(r.statut).toBe("ANNULEE");
    expect(r.annuleeAt?.getTime()).toBe(NOW.getTime());
    expect(r.paiements[0]?.statut).toBe("ECHOUE");
    expect(await sessionStatut(s)).toBe("OUVERTE");
    expect((await reserve(s, 2, client2)).ok).toBe(true);
    // Une réservation annulée ne se paie plus.
    expect((await payReservation(dbA, { reservationId: id, methode: "ESPECES" }, NOW)).ok).toBe(
      false,
    );
  });

  it("le jour du départ ou après : refusée", async () => {
    const s = await makeDepart("2026-10-10", 8);
    const { id } = unwrap(await reserve(s, 1));
    const jourJ = new Date("2026-10-10T06:00:00.000Z");
    expect(
      (await cancelReservationByClient(dbA, { reservationId: id, clientId: client1 }, jourJ)).ok,
    ).toBe(false);
  });

  it("un client ne peut pas annuler la réservation d'un autre", async () => {
    const { id } = unwrap(await reserve(await makeDepart("2026-10-10", 8), 1, client1));
    expect(
      (await cancelReservationByClient(dbA, { reservationId: id, clientId: client2 }, NOW)).ok,
    ).toBe(false);
  });
});

describe("confidentialité et isolation", () => {
  it("un client ne voit que ses propres réservations (§7.2)", async () => {
    const s = await makeDepart("2026-10-10", 8);
    const mine = unwrap(await reserve(s, 1, client1));
    const other = unwrap(await reserve(s, 1, client2));
    const list = await listClientReservations(dbA, client1, NOW);
    expect(list.map((r) => r.id)).toEqual([mine.id]);
    expect(list[0]).toMatchObject({ peutPayer: true, peutAnnuler: true, reste: 100_000 });
    expect(await getClientReservation(dbA, other.id, client1, NOW)).toBeNull();
  });

  it("un client de l'agence B ne peut pas réserver un départ de l'agence A (RG 20)", async () => {
    const s = await makeDepart("2026-10-10", 8);
    const clientB = await makeClient(agenceB.id, "b@b.test");
    const result = await reserve(s, 1, clientB, dbB, agenceB);
    expect(result).toMatchObject({ ok: false, error: "Départ introuvable." });
    expect(await raw.reservation.count()).toBe(0);
  });
});

describe("inscription d'un client", () => {
  const input = {
    agenceSlug: "green-trek-mada",
    prenom: "Voyageur",
    nom: "Test",
    email: "nouveau@exemple.test",
    telephone: null,
    password: "Motdepasse1",
    confirmPassword: "Motdepasse1",
  };

  it("crée un compte CLIENT de l'agence ; adresse déjà prise dans l'agence refusée", async () => {
    const created = await registerClient(input, raw);
    expect(created.ok).toBe(true);
    const u = await raw.utilisateur.findFirstOrThrow({ where: { email: input.email } });
    expect(u).toMatchObject({ role: "CLIENT", agenceId: agenceA.id });
    expect(u.motDePasseHash).not.toBe(input.password);
    expect(await registerClient(input, raw)).toMatchObject({ ok: false, field: "email" });
  });

  it("la même adresse peut s'inscrire dans une autre agence ; agence suspendue refusée", async () => {
    expect((await registerClient({ ...input, agenceSlug: "agence-b" }, raw)).ok).toBe(true);
    await raw.agence.update({ where: { id: agenceA.id }, data: { statut: "SUSPENDUE" } });
    expect((await registerClient(input, raw)).ok).toBe(false);
  });
});
