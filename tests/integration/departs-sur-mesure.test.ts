import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  answerDepartSurMesure,
  cancelDepartSurMesure,
  listDepartsOfItineraire,
  listUpcomingDepartsSurMesure,
  programDepart,
} from "@/lib/services/departs-sur-mesure";
import { getTenantDb, type TenantDb } from "@/lib/tenant";
import { programDepartSchema } from "@/lib/validators/itineraires-perso";

import { createTestClient, truncateAll } from "./test-db";

/**
 * Départ d'un itinéraire sur mesure (étape 9) : le voyageur programme, l'agence confirme ou
 * refuse, le voyageur peut annuler. Données de test (personnes inventées, @example.com).
 */
const raw = createTestClient();
const NOW = new Date("2026-11-25T09:00:00.000Z"); // 25 nov. 2026, midi à Madagascar

afterAll(async () => {
  await raw.$disconnect();
});

let agenceA: { id: string };
let dbA: TenantDb;
let dbB: TenantDb;
let clientId: string;
let autreClientId: string;
let itId: string;

async function user(agenceId: string, role: "CLIENT" | "ADMIN_AGENCE", email: string) {
  return (
    await raw.utilisateur.create({
      data: { agenceId, prenom: "Lova", nom: "Rabe", email, motDePasseHash: "x", role },
    })
  ).id;
}

async function itineraire(statut: "EN_ATTENTE" | "ACCEPTE" | "DECLINE", owner = clientId) {
  const calcul = await raw.itineraireCalcule.create({
    data: {
      agenceId: agenceA.id,
      algorithme: "ASTAR",
      critere: "PLUS_COURT",
      alpha: 1,
      beta: 0,
      gamma: 0,
      cheminJson: { etapes: [] },
      distanceTotaleKm: 17.5,
      dureeTotaleMin: 400,
      difficulteCumulee: 35,
      noeudsExplores: 3,
      tempsCalculMs: 1,
    },
  });
  return (
    await raw.itinerairePersonnalise.create({
      data: {
        agenceId: agenceA.id,
        clientId: owner,
        creeParId: owner,
        itineraireCalculeId: calcul.id,
        origine: "CLIENT",
        titre: "Balade côtière",
        statut,
      },
    })
  ).id;
}

beforeEach(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({ data: { nom: "Agence A", slug: "agence-a" } });
  const agenceB = await raw.agence.create({ data: { nom: "Agence B", slug: "agence-b" } });
  dbA = getTenantDb(agenceA.id, raw);
  dbB = getTenantDb(agenceB.id, raw);
  clientId = await user(agenceA.id, "CLIENT", "lova@example.com");
  autreClientId = await user(agenceA.id, "CLIENT", "autre@example.com");
  await user(agenceA.id, "ADMIN_AGENCE", "admin@agence-a.test");
  itId = await itineraire("ACCEPTE");
});

const programme = (over: Partial<Record<string, unknown>> = {}, db = dbA, client = clientId) =>
  programDepart(
    db,
    {
      itineraireId: itId,
      dateDebut: "2026-12-20",
      dateFin: "2026-12-21",
      nombrePersonnes: 3,
      remarques: "Un enfant de 10 ans",
      agenceId: agenceA.id,
      clientId: client,
      ...over,
    } as Parameters<typeof programDepart>[1],
    NOW,
  );

describe("le voyageur programme son départ", () => {
  it("itinéraire accepté : départ en attente de l'agence, équipe notifiée", async () => {
    const r = await programme();
    expect(r).toMatchObject({ ok: true, data: { modifie: false } });
    const [d] = await listDepartsOfItineraire(dbA, itId);
    expect(d).toMatchObject({
      statut: "DEMANDE",
      nombrePersonnes: 3,
      statutLabel: "En attente de l'agence",
    });
    const notif = await raw.notification.findFirstOrThrow({
      where: { titre: { startsWith: "Départ à programmer" } },
    });
    expect(notif.message).toContain("3 pers.");
  });

  it("refusé si l'itinéraire n'est pas accepté, ou s'il n'est pas à lui", async () => {
    const attente = await itineraire("EN_ATTENTE");
    expect(await programme({ itineraireId: attente })).toEqual({
      ok: false,
      error: "Le départ se programme une fois l'itinéraire accepté.",
    });
    expect(await programme({}, dbA, autreClientId)).toEqual({
      ok: false,
      error: "Itinéraire introuvable.",
    });
  });

  it("au plus tôt le lendemain ; la fin ne précède pas le début", async () => {
    const r = await programme({ dateDebut: "2026-11-25", dateFin: "2026-11-25" });
    expect(r).toMatchObject({ ok: false, field: "dateDebut" });
    expect((await programme({ dateDebut: "2026-11-26", dateFin: "2026-11-26" })).ok).toBe(true);
    expect(
      programDepartSchema.safeParse({
        itineraireId: itId,
        dateDebut: "2026-12-20",
        dateFin: "2026-12-19",
        nombrePersonnes: 2,
        remarques: null,
      }).success,
    ).toBe(false);
    expect(
      programDepartSchema.safeParse({
        itineraireId: itId,
        dateDebut: "2026-12-20",
        dateFin: "2026-12-20",
        nombrePersonnes: 0,
        remarques: null,
      }).success,
    ).toBe(false);
  });

  it("modifiable tant que l'agence n'a pas répondu (un seul départ actif)", async () => {
    await programme();
    const r = await programme({
      dateDebut: "2027-01-10",
      dateFin: "2027-01-11",
      nombrePersonnes: 2,
    });
    expect(r).toMatchObject({ ok: true, data: { modifie: true } });
    const departs = await listDepartsOfItineraire(dbA, itId);
    expect(departs).toHaveLength(1);
    expect(departs[0]!.nombrePersonnes).toBe(2);
  });
});

describe("l'agence répond", () => {
  it("confirme avec tarif, guide et message ; le voyageur est notifié ; plus modifiable", async () => {
    const { data } = (await programme()) as { data: { id: string } };
    const guide = await raw.guide.create({
      data: { agenceId: agenceA.id, prenom: "Haja", nom: "Guide", langues: [] },
    });
    const r = await answerDepartSurMesure(
      dbA,
      {
        id: data.id,
        decision: "CONFIRME",
        tarif: 450000,
        guideId: guide.id,
        reponse: "Rendez-vous à 7 h",
        agenceSlug: "agence-a",
      },
      NOW,
    );
    expect(r.ok).toBe(true);
    const [d] = await listDepartsOfItineraire(dbA, itId);
    expect(d).toMatchObject({
      statut: "CONFIRME",
      tarif: 450000,
      guide: { id: guide.id },
      reponse: "Rendez-vous à 7 h",
    });
    const notif = await raw.notification.findFirstOrThrow({ where: { utilisateurId: clientId } });
    expect(notif.titre).toBe("Votre départ est confirmé");
    expect(notif.lienUrl).toBe(`/a/agence-a/mon-compte/itineraires/${itId}`);
    expect((await programme({ dateDebut: "2027-02-01", dateFin: "2027-02-01" })).ok).toBe(false);
    expect(await listUpcomingDepartsSurMesure(dbA, NOW)).toHaveLength(1);
  });

  it("refuse ; le voyageur peut reprogrammer (l'ancien reste en historique)", async () => {
    const { data } = (await programme()) as { data: { id: string } };
    await answerDepartSurMesure(
      dbA,
      {
        id: data.id,
        decision: "REFUSE",
        tarif: null,
        guideId: null,
        reponse: "Complet ces jours-là",
        agenceSlug: "agence-a",
      },
      NOW,
    );
    expect(
      (
        await answerDepartSurMesure(
          dbA,
          {
            id: data.id,
            decision: "CONFIRME",
            tarif: null,
            guideId: null,
            reponse: null,
            agenceSlug: "agence-a",
          },
          NOW,
        )
      ).ok,
    ).toBe(false);
    expect((await programme({ dateDebut: "2027-01-05", dateFin: "2027-01-06" })).ok).toBe(true);
    expect((await listDepartsOfItineraire(dbA, itId)).map((d) => d.statut)).toEqual([
      "DEMANDE",
      "REFUSE",
    ]);
  });

  it("guide d'une autre agence ou inactif refusé", async () => {
    const { data } = (await programme()) as { data: { id: string } };
    const agenceB = await raw.agence.findFirstOrThrow({ where: { slug: "agence-b" } });
    const autre = await raw.guide.create({
      data: { agenceId: agenceB.id, prenom: "X", nom: "Y", langues: [] },
    });
    expect(
      await answerDepartSurMesure(
        dbA,
        {
          id: data.id,
          decision: "CONFIRME",
          tarif: null,
          guideId: autre.id,
          reponse: null,
          agenceSlug: "agence-a",
        },
        NOW,
      ),
    ).toMatchObject({ ok: false, field: "guideId" });
  });
});

describe("annulation et isolation", () => {
  it("le voyageur annule avant le début ; l'équipe est notifiée", async () => {
    const { data } = (await programme()) as { data: { id: string } };
    expect(await cancelDepartSurMesure(dbA, { id: data.id, clientId: autreClientId }, NOW)).toEqual(
      {
        ok: false,
        error: "Départ introuvable.",
      },
    );
    expect((await cancelDepartSurMesure(dbA, { id: data.id, clientId }, NOW)).ok).toBe(true);
    const [d] = await listDepartsOfItineraire(dbA, itId);
    expect(d!.statut).toBe("ANNULE");
    expect(
      await raw.notification.count({ where: { titre: { startsWith: "Départ annulé" } } }),
    ).toBe(1);
  });

  it("plus d'annulation ici une fois le départ commencé", async () => {
    const { data } = (await programme({ dateDebut: "2026-11-26", dateFin: "2026-11-28" })) as {
      data: { id: string };
    };
    const pendant = new Date("2026-11-27T09:00:00.000Z");
    expect((await cancelDepartSurMesure(dbA, { id: data.id, clientId }, pendant)).ok).toBe(false);
  });

  it("une autre agence ne voit, ne programme, ne confirme ni n'annule rien", async () => {
    const { data } = (await programme()) as { data: { id: string } };
    expect(await listDepartsOfItineraire(dbB, itId)).toEqual([]);
    expect((await programme({}, dbB)).ok).toBe(false);
    expect(
      (
        await answerDepartSurMesure(
          dbB,
          {
            id: data.id,
            decision: "CONFIRME",
            tarif: null,
            guideId: null,
            reponse: null,
            agenceSlug: "agence-b",
          },
          NOW,
        )
      ).ok,
    ).toBe(false);
    expect((await cancelDepartSurMesure(dbB, { id: data.id, clientId }, NOW)).ok).toBe(false);
    expect(await listUpcomingDepartsSurMesure(dbB, NOW)).toEqual([]);
  });
});
