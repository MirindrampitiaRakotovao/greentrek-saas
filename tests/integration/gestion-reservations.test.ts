import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { parseIsoDate } from "@/lib/departs";
import { getAgencyDashboard } from "@/lib/dashboard/agency";
import { getClientDetail, listClients } from "@/lib/services/clients";
import { getInvoice } from "@/lib/services/factures";
import {
  cancelReservationByAgency,
  confirmReservation,
  countATraiter,
  getReservation,
  listPaiements,
  listReservations,
  recordPayment,
  refundPayment,
  rejectPayment,
  validatePayment,
} from "@/lib/services/gestion-reservations";
import { createReservation, payReservation } from "@/lib/services/reservations";
import { getTenantDb, type TenantDb } from "@/lib/tenant";

import { createTestClient, truncateAll } from "./test-db";

/** Back-office : réservations, paiements, clients, facture (étape E10). Date du jour fixée. */
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

async function makeDepart(debut: string, places = 8) {
  const dateDebut = parseIsoDate(debut);
  return (
    await raw.sessionDepart.create({
      data: {
        agenceId: agenceA.id,
        circuitId,
        dateDebut,
        dateFin: new Date(dateDebut.getTime() + 86_400_000),
        placesTotal: places,
      },
    })
  ).id;
}

async function reserve(sessionId: string, n = 2, clientId = client1) {
  const r = await createReservation(
    dbA,
    {
      sessionId,
      participants: Array.from({ length: n }, (_, i) => ({
        prenom: `P${i}`,
        nom: "Test",
        age: null,
        nationalite: null,
        contactUrgence: null,
      })),
      remarques: null,
      agenceId: agenceA.id,
      agenceSlug: agenceA.slug,
      clientId,
    },
    NOW,
  );
  if (!r.ok) throw new Error(r.error);
  return r.data.id;
}

function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

const resa = (id: string) =>
  raw.reservation.findUniqueOrThrow({ where: { id }, include: { paiements: true } });

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
  const mk = (email: string, nom: string) =>
    raw.utilisateur.create({
      data: {
        agenceId: agenceA.id,
        nom,
        prenom: "Client",
        email,
        motDePasseHash: "x",
        role: "CLIENT",
      },
    });
  client1 = (await mk("c1@a.test", "Rakoto")).id;
  client2 = (await mk("c2@a.test", "Rabe")).id;
});

describe("confirmation et annulation par l'agence", () => {
  it("décision A : confirme une réservation en attente, même non payée ; reste à payer affiché", async () => {
    const id = await reserve(await makeDepart("2026-10-10"));
    unwrap(await confirmReservation(dbA, id, NOW));
    const detail = await getReservation(dbA, id, NOW);
    expect(detail).toMatchObject({ statut: "CONFIRMEE", paye: 0, reste: 200_000 });
    expect(detail?.confirmeeAt?.getTime()).toBe(NOW.getTime());
    expect((await confirmReservation(dbA, id, NOW)).ok).toBe(false);
  });

  it("annulation (RG 15) : places libérées, départ rouvert ; refusée une fois le départ commencé", async () => {
    const s = await makeDepart("2026-10-10", 2);
    const id = await reserve(s, 2);
    expect((await raw.sessionDepart.findUniqueOrThrow({ where: { id: s } })).statut).toBe(
      "COMPLETE",
    );
    unwrap(await cancelReservationByAgency(dbA, id, NOW));
    expect((await resa(id)).statut).toBe("ANNULEE");
    expect((await raw.sessionDepart.findUniqueOrThrow({ where: { id: s } })).statut).toBe(
      "OUVERTE",
    );
    const id2 = await reserve(s, 1);
    const jourJ = new Date("2026-10-10T08:00:00.000Z");
    expect((await cancelReservationByAgency(dbA, id2, jourJ)).ok).toBe(false);
  });

  it("décision B : une réservation confirmée passe TERMINEE quand son départ est terminé", async () => {
    const id = await reserve(await makeDepart("2026-10-10"));
    unwrap(await confirmReservation(dbA, id, NOW));
    const apres = new Date("2026-10-15T08:00:00.000Z");
    expect((await getReservation(dbA, id, apres))?.statut).toBe("TERMINEE");
  });
});

describe("paiements côté agence (RG 16)", () => {
  it("encaissement partiel puis solde : la réservation passe CONFIRMEE une fois tout payé", async () => {
    const id = await reserve(await makeDepart("2026-10-10"));
    expect(
      unwrap(
        await recordPayment(dbA, { reservationId: id, montant: 50_000, methode: "ESPECES" }, NOW),
      ),
    ).toEqual({ confirmee: false });
    // Au-delà du reste à payer : refusé.
    expect(
      await recordPayment(dbA, { reservationId: id, montant: 150_001, methode: "ESPECES" }, NOW),
    ).toMatchObject({ ok: false, field: "montant" });
    expect(
      unwrap(
        await recordPayment(dbA, { reservationId: id, montant: 150_000, methode: "VIREMENT" }, NOW),
      ),
    ).toEqual({ confirmee: true });
    const r = await resa(id);
    expect(r.statut).toBe("CONFIRMEE");
    expect(r.paiements.reduce((t, p) => t + p.montant, 0)).toBe(200_000);
    expect(
      (await recordPayment(dbA, { reservationId: id, montant: 1, methode: "ESPECES" }, NOW)).ok,
    ).toBe(false);
  });

  it("validation d'un virement en attente : paiement VALIDE, réservation CONFIRMEE", async () => {
    const id = await reserve(await makeDepart("2026-10-10"));
    unwrap(await payReservation(dbA, { reservationId: id, methode: "VIREMENT" }, NOW));
    const [paiement] = (await resa(id)).paiements;
    expect(unwrap(await validatePayment(dbA, paiement!.id, NOW))).toEqual({ confirmee: true });
    expect((await resa(id)).paiements[0]?.statut).toBe("VALIDE");
    expect((await validatePayment(dbA, paiement!.id, NOW)).ok).toBe(false); // déjà traité
  });

  it("refus d'un paiement en attente : le client peut payer à nouveau", async () => {
    const id = await reserve(await makeDepart("2026-10-10"));
    unwrap(await payReservation(dbA, { reservationId: id, methode: "ESPECES" }, NOW));
    const [paiement] = (await resa(id)).paiements;
    unwrap(await rejectPayment(dbA, paiement!.id));
    expect((await payReservation(dbA, { reservationId: id, methode: "VIREMENT" }, NOW)).ok).toBe(
      true,
    );
  });

  it("décision C : remboursement seulement pour une réservation annulée", async () => {
    const id = await reserve(await makeDepart("2026-10-10"));
    unwrap(
      await payReservation(
        dbA,
        { reservationId: id, methode: "CARTE_SIMULEE", numero: "4970101010101010" },
        NOW,
      ),
    );
    const [paiement] = (await resa(id)).paiements;
    expect((await refundPayment(dbA, paiement!.id)).ok).toBe(false); // réservation confirmée
    unwrap(await cancelReservationByAgency(dbA, id, NOW));
    expect((await countATraiter(dbA, NOW)).aRembourser).toBe(1);
    unwrap(await refundPayment(dbA, paiement!.id));
    expect((await resa(id)).paiements[0]?.statut).toBe("REMBOURSE");
    expect((await countATraiter(dbA, NOW)).aRembourser).toBe(0);
  });

  it("paiement du client et encaissement de l'agence simultanés : jamais plus que le montant", async () => {
    const id = await reserve(await makeDepart("2026-10-10"), 1);
    await Promise.all([
      payReservation(
        dbA,
        { reservationId: id, methode: "CARTE_SIMULEE", numero: "4970101010101010" },
        NOW,
      ),
      recordPayment(dbA, { reservationId: id, montant: 100_000, methode: "ESPECES" }, NOW),
    ]);
    const valides = (await resa(id)).paiements.filter((p) => p.statut === "VALIDE");
    expect(valides.reduce((t, p) => t + p.montant, 0)).toBe(100_000);
  });
});

describe("listes, à traiter, clients", () => {
  it("filtres : statut, recherche par référence ou nom de client, période", async () => {
    const s = await makeDepart("2026-10-10");
    const a = await reserve(s, 1, client1);
    const b = await reserve(s, 1, client2);
    unwrap(await confirmReservation(dbA, b, NOW));
    expect((await listReservations(dbA, { periode: "tous" }, 1, NOW)).total).toBe(2);
    const enAttente = await listReservations(
      dbA,
      { periode: "tous", statut: "EN_ATTENTE" },
      1,
      NOW,
    );
    expect(enAttente.items.map((r) => r.id)).toEqual([a]);
    expect((await listReservations(dbA, { periode: "tous", q: "Rabe" }, 1, NOW)).items[0]?.id).toBe(
      b,
    );
    const ref = (await resa(a)).reference;
    expect((await listReservations(dbA, { periode: "tous", q: ref }, 1, NOW)).total).toBe(1);
    expect((await listReservations(dbA, { periode: "passes" }, 1, NOW)).total).toBe(0);
  });

  it("à traiter : réservations en attente, paiements à valider, à régulariser", async () => {
    const id = await reserve(await makeDepart("2026-10-10"));
    unwrap(await payReservation(dbA, { reservationId: id, methode: "VIREMENT" }, NOW));
    const plusTard = new Date("2026-10-11T08:00:00.000Z"); // le départ a commencé
    expect(await countATraiter(dbA, NOW)).toEqual({
      enAttente: 1,
      paiementsAValider: 1,
      aRegulariser: 0,
      aRembourser: 0,
    });
    expect((await countATraiter(dbA, plusTard)).aRegulariser).toBe(1);
    const paiements = await listPaiements(dbA, { statut: "EN_ATTENTE" }, 1);
    expect(paiements.items[0]?.reservation.id).toBe(id);
  });

  it("clients : totaux des réservations non annulées, fiche avec historique", async () => {
    const s = await makeDepart("2026-10-10");
    await reserve(s, 2, client1);
    const annulee = await reserve(s, 1, client1);
    unwrap(await cancelReservationByAgency(dbA, annulee, NOW));
    const list = await listClients(dbA, "Rakoto", 1);
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ reservations: 2, totalReserve: 200_000 });
    expect((await getClientDetail(dbA, client1))?.reservations).toHaveLength(2);
  });
});

describe("tableau de bord cohérent avec les données (définition de « terminé » d'E10)", () => {
  it("réservation, paiement puis annulation : les indicateurs suivent", async () => {
    const s = await makeDepart("2026-10-10", 10);
    const kpis = async () => (await getAgencyDashboard(dbA, agenceA.id, NOW)).kpis;
    const avant = await kpis();
    expect(avant.reservations.value).toBe(0);

    const id = await reserve(s, 3);
    let k = await kpis();
    expect(k.reservations.value).toBe(1);
    expect(k.montantReserve.value).toBe(300_000);
    expect(k.remplissage).toMatchObject({ reservees: 3, places: 10 });

    unwrap(
      await recordPayment(dbA, { reservationId: id, montant: 100_000, methode: "ESPECES" }, NOW),
    );
    expect((await kpis()).encaisse.value).toBe(100_000);

    unwrap(await cancelReservationByAgency(dbA, id, NOW));
    k = await kpis();
    expect(k.reservations.value).toBe(0); // annulations exclues
    expect(k.montantReserve.value).toBe(0);
    expect(k.remplissage.reservees).toBe(0);
  });
});

describe("facture", () => {
  it("pro forma tant qu'il reste à payer, acquittée une fois payée, annulée sinon", async () => {
    const id = await reserve(await makeDepart("2026-10-10"), 2);
    expect(await getInvoice(dbA, agenceA.id, id)).toMatchObject({
      etat: "PROFORMA",
      prixUnitaire: 100_000,
      reste: 200_000,
    });
    unwrap(
      await recordPayment(dbA, { reservationId: id, montant: 200_000, methode: "ESPECES" }, NOW),
    );
    expect((await getInvoice(dbA, agenceA.id, id))?.etat).toBe("ACQUITTEE");
    const id2 = await reserve(await makeDepart("2026-10-20"), 1);
    unwrap(await cancelReservationByAgency(dbA, id2, NOW));
    expect((await getInvoice(dbA, agenceA.id, id2))?.etat).toBe("ANNULEE");
  });
});

describe("isolation entre agences (RG 20)", () => {
  it("l'agence B ne voit ni ne modifie les réservations, paiements, clients et factures de A", async () => {
    const id = await reserve(await makeDepart("2026-10-10"));
    unwrap(await payReservation(dbA, { reservationId: id, methode: "VIREMENT" }, NOW));
    const [paiement] = (await resa(id)).paiements;
    expect((await listReservations(dbB, { periode: "tous" }, 1, NOW)).total).toBe(0);
    expect(await getReservation(dbB, id, NOW)).toBeNull();
    expect((await confirmReservation(dbB, id, NOW)).ok).toBe(false);
    expect((await cancelReservationByAgency(dbB, id, NOW)).ok).toBe(false);
    expect(
      (await recordPayment(dbB, { reservationId: id, montant: 1, methode: "ESPECES" }, NOW)).ok,
    ).toBe(false);
    expect((await validatePayment(dbB, paiement!.id, NOW)).ok).toBe(false);
    expect((await listPaiements(dbB, {}, 1)).total).toBe(0);
    expect((await listClients(dbB, undefined, 1)).total).toBe(0);
    expect(await getClientDetail(dbB, client1)).toBeNull();
    expect(await getInvoice(dbB, agenceB.id, id)).toBeNull();
    expect((await resa(id)).statut).toBe("EN_ATTENTE");
  });
});
