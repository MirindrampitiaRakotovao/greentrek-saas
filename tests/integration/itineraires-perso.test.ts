import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { pushContent } from "@/lib/push/expo";
import { computeItineraire } from "@/lib/services/itineraires";
import {
  answerDemande,
  answerItineraire,
  CLIENT_CALCULS_PAR_HEURE,
  computeForClient,
  getItineraireClient,
  listItinerairesAgence,
  listItinerairesClient,
  proposeItineraire,
  requestItineraire,
} from "@/lib/services/itineraires-perso";
import { getTenantDb, type TenantDb } from "@/lib/tenant";

import { REF_EDGES, REF_NODES } from "../unit/graph/reference-graph";
import { createTestClient, truncateAll } from "./test-db";

/**
 * Itinéraires sur mesure proposés par l'agence (étape 4a, après E12) : à partir d'un calcul
 * de l'historique (graphe de référence), visibles par le seul client concerné, réponse unique.
 */
const raw = createTestClient();
const NOW = new Date("2026-11-19T09:00:00.000Z");

afterAll(async () => {
  await raw.$disconnect();
});

let agenceA: { id: string; slug: string };
let agenceB: { id: string; slug: string };
let dbA: TenantDb;
let dbB: TenantDb;
let adminA: string;
let adminB: string;
let client1: string;
let client2: string;
const node: Record<string, string> = {};

async function user(agenceId: string, email: string, role: "ADMIN_AGENCE" | "CLIENT") {
  return (
    await raw.utilisateur.create({
      data: { agenceId, email, prenom: "Hery", nom: "Test", motDePasseHash: "x", role },
    })
  ).id;
}

/** Calcul (A*, le plus court) enregistré dans l'historique : renvoie son identifiant. */
async function calcul(db: TenantDb, agenceId: string, auteur: string, from = "A", to = "F") {
  const res = await computeItineraire(db, agenceId, auteur, {
    etapeDepartId: node[from]!,
    etapeArriveeId: node[to]!,
    etapesImposees: [],
    ordreLibre: false,
    critere: "PLUS_COURT",
    alpha: 1,
    beta: 0,
    gamma: 0,
    algorithme: "ASTAR",
  });
  if (!res.ok) throw new Error(res.error);
  return res.data[0]!.historiqueId!;
}

beforeEach(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({ data: { nom: "Agence A", slug: "agence-a" } });
  agenceB = await raw.agence.create({ data: { nom: "Agence B", slug: "agence-b" } });
  dbA = getTenantDb(agenceA.id, raw);
  dbB = getTenantDb(agenceB.id, raw);
  adminA = await user(agenceA.id, "admin@a.test", "ADMIN_AGENCE");
  adminB = await user(agenceB.id, "admin@b.test", "ADMIN_AGENCE");
  client1 = await user(agenceA.id, "client1@example.com", "CLIENT");
  client2 = await user(agenceA.id, "client2@example.com", "CLIENT");
  for (const agence of [agenceA, agenceB]) {
    for (const n of REF_NODES) {
      const etape = await raw.etape.create({
        data: {
          agenceId: agence.id,
          nom: n.id,
          type: "VILLAGE",
          latitude: n.latitude,
          longitude: n.longitude,
        },
      });
      if (agence === agenceA) node[n.id] = etape.id;
      else node[`B-${n.id}`] = etape.id;
    }
  }
  for (const e of REF_EDGES) {
    await raw.troncon.create({
      data: {
        agenceId: agenceA.id,
        etapeDepartId: node[e.from]!,
        etapeArriveeId: node[e.to]!,
        distanceKm: e.distanceKm,
        dureeMinutes: e.dureeMinutes,
        difficulte: e.difficulte,
        bidirectionnel: e.bidirectionnel,
      },
    });
  }
});

const propose = (db: TenantDb, historiqueId: string, clientId = client1) =>
  proposeItineraire(
    db,
    {
      agenceId: agenceA.id,
      agenceSlug: agenceA.slug,
      auteurId: adminA,
      clientId,
      historiqueId,
      titre: "Boucle des villages",
      message: "Idéal en saison sèche.",
    },
    NOW,
  );

describe("itinéraire proposé par l'agence", () => {
  it("reprend le calcul de l'historique ; le client est notifié (lien vers l'itinéraire)", async () => {
    const historiqueId = await calcul(dbA, agenceA.id, adminA);
    const res = await propose(dbA, historiqueId);
    expect(res).toEqual({ ok: true, data: { id: expect.any(String) } });
    const id = res.ok ? res.data.id : "";

    const [it] = await listItinerairesClient(dbA, client1);
    const ref = await raw.itineraireCalcule.findUniqueOrThrow({ where: { id: historiqueId } });
    expect(it).toMatchObject({
      id,
      origine: "AGENCE",
      statut: "EN_ATTENTE",
      titre: "Boucle des villages",
      distanceKm: ref.distanceTotaleKm,
      dureeMinutes: ref.dureeTotaleMin,
      depart: "A",
      arrivee: "F",
    });
    expect(it!.etapes.length).toBeGreaterThan(1);
    // Difficulté moyenne pondérée par la distance, comme le calculateur (1 à 5).
    expect(it!.difficulteMoyenne).toBeCloseTo(ref.difficulteCumulee / ref.distanceTotaleKm, 6);
    expect(it!.difficulteMoyenne).toBeGreaterThanOrEqual(1);
    expect(it!.difficulteMoyenne).toBeLessThanOrEqual(5);

    const notif = await raw.notification.findFirstOrThrow({ where: { utilisateurId: client1 } });
    expect(notif.lienUrl).toBe(`/a/agence-a/mon-compte/itineraires/${id}`);
    // Sur le téléphone, la notification ouvre cet itinéraire.
    expect(
      pushContent({
        type: "notification",
        titre: notif.titre,
        message: notif.message,
        lienUrl: notif.lienUrl,
      }).data,
    ).toEqual({ type: "itineraire", itineraireId: id });
  });

  it("refuse un calcul d'une autre agence et un destinataire qui n'est pas un client", async () => {
    // Calcul enregistré dans l'historique de l'agence B.
    const autre = (
      await raw.itineraireCalcule.create({
        data: {
          agenceId: agenceB.id,
          algorithme: "ASTAR",
          critere: "PLUS_COURT",
          alpha: 1,
          beta: 0,
          gamma: 0,
          cheminJson: { etapes: [] },
          distanceTotaleKm: 1,
          dureeTotaleMin: 10,
          difficulteCumulee: 1,
          noeudsExplores: 1,
          tempsCalculMs: 0.1,
          creeParId: adminB,
        },
      })
    ).id;
    expect(await propose(dbA, autre)).toEqual({
      ok: false,
      error: "Calculez d'abord l'itinéraire.",
    });
    const historiqueId = await calcul(dbA, agenceA.id, adminA);
    expect(await propose(dbA, historiqueId, adminA)).toEqual({
      ok: false,
      error: "Client introuvable.",
    });
    expect(await raw.itinerairePersonnalise.count()).toBe(0);
  });

  it("visible par le seul client concerné et par son agence", async () => {
    const historiqueId = await calcul(dbA, agenceA.id, adminA);
    const res = await propose(dbA, historiqueId);
    const id = res.ok ? res.data.id : "";
    expect(await getItineraireClient(dbA, id, client1)).not.toBeNull();
    expect(await getItineraireClient(dbA, id, client2)).toBeNull();
    expect(await listItinerairesClient(dbA, client2)).toEqual([]);
    expect((await listItinerairesAgence(dbA, { clientId: client1 })).total).toBe(1);
    // Une autre agence ne voit rien.
    expect((await listItinerairesAgence(dbB, {})).total).toBe(0);
    expect(await dbB.itinerairePersonnalise.findFirst({ where: { id } })).toBeNull();
  });

  it("le client accepte une seule fois ; l'équipe est prévenue", async () => {
    const historiqueId = await calcul(dbA, agenceA.id, adminA);
    const res = await propose(dbA, historiqueId);
    const id = res.ok ? res.data.id : "";

    expect(
      (
        await answerItineraire(
          dbA,
          { id, clientId: client2, decision: "ACCEPTE", reponse: null },
          NOW,
        )
      ).ok,
    ).toBe(false);
    expect(
      await answerItineraire(
        dbA,
        { id, clientId: client1, decision: "ACCEPTE", reponse: "Parfait !" },
        NOW,
      ),
    ).toEqual({ ok: true, data: undefined });
    expect(
      await answerItineraire(
        dbA,
        { id, clientId: client1, decision: "DECLINE", reponse: null },
        NOW,
      ),
    ).toEqual({ ok: false, error: "Vous avez déjà répondu à cette proposition." });

    const it = await getItineraireClient(dbA, id, client1);
    expect(it).toMatchObject({ statut: "ACCEPTE", reponse: "Parfait !" });
    const staff = await raw.notification.findMany({ where: { utilisateurId: adminA } });
    expect(staff.map((n) => n.titre)).toEqual(["Itinéraire accepté par Hery Test"]);
  });
});

describe("itinéraire composé par le voyageur (4b)", () => {
  const calculClient = (clientId = client1, to = "F") =>
    computeForClient(dbA, {
      agenceId: agenceA.id,
      clientId,
      etapeDepartId: node.A!,
      etapeArriveeId: node[to]!,
      etapesImposees: [],
      ordreLibre: false,
      critere: "PLUS_FACILE",
    });
  const demande = (historiqueId: string, clientId = client1) =>
    requestItineraire(
      dbA,
      {
        agenceId: agenceA.id,
        clientId,
        historiqueId,
        titre: "Ma randonnée",
        message: "Deux voyageurs, en mai.",
      },
      NOW,
    );

  it("calcul sur le réseau de SON agence, enregistré à son nom", async () => {
    const res = await calculClient();
    expect(res.ok && res.data.found).toBe(true);
    const id = res.ok ? res.data.historiqueId! : "";
    const row = await raw.itineraireCalcule.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ creeParId: client1, critere: "PLUS_FACILE", algorithme: "ASTAR" });
    // Une étape d'une autre agence est inconnue.
    const ailleurs = await computeForClient(dbA, {
      agenceId: agenceA.id,
      clientId: client1,
      etapeDepartId: node["B-A"]!,
      etapeArriveeId: node.F!,
      etapesImposees: [],
      ordreLibre: false,
      critere: "PLUS_COURT",
    });
    expect(ailleurs).toEqual({
      ok: false,
      error: "Étape introuvable dans le réseau de l'agence.",
    });
  });

  it(`au plus ${CLIENT_CALCULS_PAR_HEURE} calculs par heure et par voyageur`, async () => {
    await raw.itineraireCalcule.createMany({
      data: Array.from({ length: CLIENT_CALCULS_PAR_HEURE }, () => ({
        agenceId: agenceA.id,
        algorithme: "ASTAR" as const,
        critere: "PLUS_COURT" as const,
        alpha: 1,
        beta: 0,
        gamma: 0,
        cheminJson: { etapes: [] },
        distanceTotaleKm: 1,
        dureeTotaleMin: 10,
        difficulteCumulee: 1,
        noeudsExplores: 1,
        tempsCalculMs: 0.1,
        creeParId: client1,
      })),
    });
    expect((await calculClient()).ok).toBe(false);
    // L'autre voyageur n'est pas concerné.
    expect((await calculClient(client2)).ok).toBe(true);
  });

  it("envoi à l'agence : ses propres calculs seulement ; l'équipe est prévenue", async () => {
    const res = await calculClient();
    const historiqueId = res.ok ? res.data.historiqueId! : "";
    // Le calcul d'un autre (l'agence, un autre voyageur) ne peut pas être envoyé.
    const autre = await calcul(dbA, agenceA.id, adminA);
    expect(await demande(autre)).toEqual({ ok: false, error: "Calculez d'abord l'itinéraire." });
    expect(await demande(historiqueId, client2)).toEqual({
      ok: false,
      error: "Calculez d'abord l'itinéraire.",
    });

    const ok = await demande(historiqueId);
    expect(ok.ok).toBe(true);
    const id = ok.ok ? ok.data.id : "";
    const [it] = (await listItinerairesAgence(dbA, { origine: "CLIENT" })).items;
    expect(it).toMatchObject({
      id,
      origine: "CLIENT",
      statut: "EN_ATTENTE",
      titre: "Ma randonnée",
    });
    const notif = await raw.notification.findFirstOrThrow({ where: { utilisateurId: adminA } });
    expect(notif).toMatchObject({
      titre: "Demande d'itinéraire de Hery Test",
      lienUrl: `/dashboard/itineraires-sur-mesure/${id}`,
    });
  });

  it("l'agence répond une fois ; le voyageur est prévenu ; chacun ne répond qu'à l'autre", async () => {
    const res = await calculClient();
    const ok = await demande(res.ok ? res.data.historiqueId! : "");
    const id = ok.ok ? ok.data.id : "";

    // Le voyageur ne répond pas à sa propre demande.
    expect(
      (
        await answerItineraire(
          dbA,
          { id, clientId: client1, decision: "ACCEPTE", reponse: null },
          NOW,
        )
      ).ok,
    ).toBe(false);
    const answer = (decision: "ACCEPTE" | "DECLINE") =>
      answerDemande(
        dbA,
        { id, agenceSlug: agenceA.slug, decision, reponse: "Départ possible le 12 mai." },
        NOW,
      );
    expect(await answer("ACCEPTE")).toEqual({ ok: true, data: undefined });
    expect(await answer("DECLINE")).toEqual({
      ok: false,
      error: "Cette demande a déjà reçu une réponse.",
    });
    const notif = await raw.notification.findFirstOrThrow({ where: { utilisateurId: client1 } });
    expect(notif).toMatchObject({
      titre: "Votre agence accepte votre itinéraire",
      lienUrl: `/a/agence-a/mon-compte/itineraires/${id}`,
    });

    // L'agence ne répond pas à sa propre proposition ; une autre agence ne voit pas la demande.
    const proposition = await propose(dbA, await calcul(dbA, agenceA.id, adminA));
    expect(
      await answerDemande(dbA, {
        id: proposition.ok ? proposition.data.id : "",
        agenceSlug: agenceA.slug,
        decision: "ACCEPTE",
        reponse: null,
      }),
    ).toEqual({ ok: false, error: "Cet itinéraire attend la réponse du voyageur." });
    expect(
      await answerDemande(dbB, {
        id,
        agenceSlug: agenceB.slug,
        decision: "ACCEPTE",
        reponse: null,
      }),
    ).toEqual({ ok: false, error: "Itinéraire introuvable." });
  });
});
