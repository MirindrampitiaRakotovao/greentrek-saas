import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { parseIsoDate } from "@/lib/departs";
import {
  circuitRatings,
  createAvis,
  listAvis,
  listPublicAvis,
  moderateAvis,
} from "@/lib/services/avis";
import { confirmReservation } from "@/lib/services/gestion-reservations";
import { listJournal, logAgencyActivity } from "@/lib/services/journal";
import { markNotificationsRead } from "@/lib/services/notifications";
import { getClientReservation } from "@/lib/services/reservations";
import { searchCircuits } from "@/lib/services/vitrine";
import { getTenantDb, type TenantDb } from "@/lib/tenant";

import { createTestClient, truncateAll } from "./test-db";

/** Avis (RG 17), modération, notifications et journal d'activité (étape E12). */
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
let staff: string;
let sessionPassee: string;
let sessionFuture: string;

async function makeSession(debut: string) {
  const dateDebut = parseIsoDate(debut);
  return (
    await raw.sessionDepart.create({
      data: {
        agenceId: agenceA.id,
        circuitId,
        dateDebut,
        dateFin: new Date(dateDebut.getTime() + 86_400_000),
        placesTotal: 10,
      },
    })
  ).id;
}

let seq = 0;
async function makeReservation(
  sessionId: string,
  statut: "EN_ATTENTE" | "CONFIRMEE" | "TERMINEE",
  clientId = client1,
) {
  seq += 1;
  return (
    await raw.reservation.create({
      data: {
        agenceId: agenceA.id,
        reference: `GTM-2026-${String(seq).padStart(4, "0")}`,
        clientId,
        sessionId,
        nombrePersonnes: 2,
        montantTotal: 200_000,
        statut,
      },
    })
  ).id;
}

function avisInput(reservationId: string, clientId = client1, note = 5) {
  return {
    agenceId: agenceA.id,
    reservationId,
    clientId,
    note,
    commentaire: "Très beau sentier, guide attentionné.",
  };
}

beforeEach(async () => {
  await truncateAll(raw);
  seq = 0;
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
  const mk = (email: string, prenom: string, nom: string, role: "CLIENT" | "STAFF") =>
    raw.utilisateur.create({
      data: { agenceId: agenceA.id, prenom, nom, email, motDePasseHash: "x", role },
    });
  client1 = (await mk("c1@a.test", "Hery", "Rakoto", "CLIENT")).id;
  client2 = (await mk("c2@a.test", "Voahangy", "Rabe", "CLIENT")).id;
  staff = (await mk("staff@a.test", "Mamy", "Staff", "STAFF")).id;
  sessionPassee = await makeSession("2026-09-01");
  sessionFuture = await makeSession("2026-10-20");
});

describe("RG 17 : avis sur une réservation terminée", () => {
  it("accepte un avis EN_ATTENTE et notifie l'équipe", async () => {
    const id = await makeReservation(sessionPassee, "TERMINEE");
    const result = await createAvis(dbA, avisInput(id), NOW);
    expect(result.ok).toBe(true);
    const avis = await raw.avis.findUniqueOrThrow({ where: { reservationId: id } });
    expect(avis).toMatchObject({ statut: "EN_ATTENTE", circuitId, note: 5 });
    const notifs = await raw.notification.findMany({ where: { utilisateurId: staff } });
    expect(notifs).toHaveLength(1);
    expect(notifs[0]).toMatchObject({ type: "AVIS", lienUrl: "/dashboard/avis" });
  });

  it("refuse un second avis pour la même réservation", async () => {
    const id = await makeReservation(sessionPassee, "TERMINEE");
    expect((await createAvis(dbA, avisInput(id), NOW)).ok).toBe(true);
    const second = await createAvis(dbA, avisInput(id, client1, 2), NOW);
    expect(second).toMatchObject({ ok: false });
    expect(await raw.avis.count()).toBe(1);
  });

  it("refuse un avis tant que le séjour n'est pas terminé", async () => {
    const id = await makeReservation(sessionFuture, "CONFIRMEE");
    expect((await createAvis(dbA, avisInput(id), NOW)).ok).toBe(false);
  });

  it("refuse l'avis d'un autre client que le titulaire", async () => {
    const id = await makeReservation(sessionPassee, "TERMINEE");
    expect((await createAvis(dbA, avisInput(id, client2), NOW)).ok).toBe(false);
  });

  it("une autre agence ne peut pas déposer d'avis sur la réservation", async () => {
    const id = await makeReservation(sessionPassee, "TERMINEE");
    const result = await createAvis(dbB, { ...avisInput(id), agenceId: agenceB.id }, NOW);
    expect(result.ok).toBe(false);
    expect(await raw.avis.count()).toBe(0);
  });

  it("l'espace client passe la réservation à TERMINEE après le séjour et propose l'avis", async () => {
    const id = await makeReservation(sessionPassee, "CONFIRMEE");
    const r = await getClientReservation(dbA, id, client1, NOW);
    expect(r).toMatchObject({ statut: "TERMINEE", peutDonnerAvis: true, avis: null });
    await createAvis(dbA, avisInput(id), NOW);
    const apres = await getClientReservation(dbA, id, client1, NOW);
    expect(apres).toMatchObject({ peutDonnerAvis: false, avis: { statut: "EN_ATTENTE" } });
  });
});

describe("modération et affichage public", () => {
  async function avisDepose(note: number, clientId = client1) {
    const id = await makeReservation(sessionPassee, "TERMINEE", clientId);
    await createAvis(dbA, avisInput(id, clientId, note), NOW);
    return (await raw.avis.findUniqueOrThrow({ where: { reservationId: id } })).id;
  }

  it("seuls les avis publiés comptent dans la note et apparaissent sur le site", async () => {
    const a1 = await avisDepose(5);
    const a2 = await avisDepose(4, client2);
    await avisDepose(1);
    expect((await moderateAvis(dbA, a1, "PUBLIE")).ok).toBe(true);
    expect((await moderateAvis(dbA, a2, "PUBLIE")).ok).toBe(true);

    const notes = await circuitRatings(dbA, [circuitId]);
    expect(notes.get(circuitId)).toEqual({ moyenne: 4.5, nombre: 2 });

    const publics = await listPublicAvis(dbA);
    expect(publics).toHaveLength(2);
    // Données personnelles minimales : prénom et initiale du nom.
    expect(publics.map((a) => a.auteur).sort()).toEqual(["Hery R.", "Voahangy R."]);

    const cards = await searchCircuits(dbA, {}, NOW);
    expect(cards[0]?.note).toEqual({ moyenne: 4.5, nombre: 2 });

    expect((await listAvis(dbA, "EN_ATTENTE", 1)).total).toBe(1);
  });

  it("un avis rejeté n'est pas affiché ; la décision peut être revue", async () => {
    const id = await avisDepose(3);
    await moderateAvis(dbA, id, "REJETE");
    expect(await listPublicAvis(dbA)).toHaveLength(0);
    await moderateAvis(dbA, id, "PUBLIE");
    expect(await listPublicAvis(dbA)).toHaveLength(1);
  });

  it("isolation : l'agence B ne voit ni ne modère les avis de A", async () => {
    const id = await avisDepose(5);
    expect((await listAvis(dbB, undefined, 1)).total).toBe(0);
    expect((await moderateAvis(dbB, id, "PUBLIE")).ok).toBe(false);
    expect((await raw.avis.findUniqueOrThrow({ where: { id } })).statut).toBe("EN_ATTENTE");
    expect(await listPublicAvis(dbB)).toHaveLength(0);
  });
});

describe("notifications", () => {
  it("la confirmation par l'agence notifie le client, avec un lien vers sa réservation", async () => {
    const id = await makeReservation(sessionFuture, "EN_ATTENTE");
    expect((await confirmReservation(dbA, id, NOW)).ok).toBe(true);
    const notifs = await raw.notification.findMany({ where: { utilisateurId: client1 } });
    expect(notifs).toHaveLength(1);
    expect(notifs[0]?.lienUrl).toBe(`/a/${agenceA.slug}/mon-compte/reservations/${id}`);
  });

  it("marquer comme lu ne touche que les notifications de l'utilisateur", async () => {
    const base = { agenceId: agenceA.id, type: "RESERVATION", titre: "T", message: "M" };
    await raw.notification.createMany({
      data: [
        { ...base, utilisateurId: client1 },
        { ...base, utilisateurId: client2 },
      ],
    });
    await markNotificationsRead(dbA, client1);
    const lues = await raw.notification.findMany({ select: { utilisateurId: true, lue: true } });
    expect(lues.find((n) => n.utilisateurId === client1)?.lue).toBe(true);
    expect(lues.find((n) => n.utilisateurId === client2)?.lue).toBe(false);
  });
});

describe("journal d'activité", () => {
  it("trace une action et l'isole par agence", async () => {
    await logAgencyActivity(dbA, agenceA.id, {
      utilisateurId: staff,
      action: "RESERVATION_CONFIRMEE",
      entite: "Reservation",
      entiteId: "x",
    });
    const journalA = await listJournal(dbA, 1);
    expect(journalA.total).toBe(1);
    expect(journalA.items[0]).toMatchObject({
      action: "RESERVATION_CONFIRMEE",
      utilisateur: { prenom: "Mamy" },
    });
    expect((await listJournal(dbB, 1)).total).toBe(0);
  });

  it("refuse une écriture dans le journal d'une autre agence", async () => {
    await expect(
      logAgencyActivity(dbB, agenceA.id, {
        utilisateurId: null,
        action: "AGENCE_PARAMETRES",
        entite: "Agence",
      }),
    ).rejects.toThrow();
    expect(await raw.journalActivite.count()).toBe(0);
  });
});
