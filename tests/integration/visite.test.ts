import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { visitParty, visitWaypoints } from "@/lib/services/visite";
import { getTenantDb, type TenantDb } from "@/lib/tenant";

import { createTestClient, truncateAll } from "./test-db";

/** Visite virtuelle « mode jeu » (étape 8b) : groupe de la réservation et pirogue. */
const raw = createTestClient();

afterAll(async () => {
  await raw.$disconnect();
});

let dbA: TenantDb;
let dbB: TenantDb;
let agenceId: string;
let ids: Record<string, string>;

beforeEach(async () => {
  await truncateAll(raw);
  const a = await raw.agence.create({ data: { nom: "Agence A", slug: "agence-a" } });
  const b = await raw.agence.create({ data: { nom: "Agence B", slug: "agence-b" } });
  agenceId = a.id;
  dbA = getTenantDb(a.id, raw);
  dbB = getTenantDb(b.id, raw);
  ids = {};
  for (const [nom, lat] of [
    ["A", -17.49],
    ["B", -17.48],
    ["C", -17.47],
  ] as const) {
    ids[nom] = (
      await raw.etape.create({
        data: { agenceId, nom, type: "VILLAGE", latitude: lat, longitude: 49.45 },
      })
    ).id;
  }
});

const troncon = (from: string, to: string, mode: "MARCHE" | "PIROGUE", bidirectionnel = true) =>
  raw.troncon.create({
    data: {
      agenceId,
      etapeDepartId: ids[from]!,
      etapeArriveeId: ids[to]!,
      distanceKm: 1,
      dureeMinutes: 15,
      difficulte: 1,
      bidirectionnel,
      mode,
    },
  });

const path = (...noms: string[]) => noms.map((n) => ({ id: ids[n]!, latitude: 0, longitude: 0 }));

describe("pirogue le long du chemin", () => {
  it("mode du tronçon qui part de chaque étape, dans les deux sens s'il est à double sens", async () => {
    await troncon("A", "B", "MARCHE");
    await troncon("C", "B", "PIROGUE");
    const aller = await visitWaypoints(dbA, path("A", "B", "C"));
    expect(aller.map((w) => w.modeSuivant)).toEqual(["MARCHE", "PIROGUE", "MARCHE"]);
    const retour = await visitWaypoints(dbA, path("C", "B", "A"));
    expect(retour.map((w) => w.modeSuivant)).toEqual(["PIROGUE", "MARCHE", "MARCHE"]);
  });

  it("à sens unique : la pirogue ne vaut que dans son sens ; une autre agence ne voit rien", async () => {
    await troncon("B", "C", "PIROGUE", false);
    expect((await visitWaypoints(dbA, path("C", "B"))).map((w) => w.modeSuivant)).toEqual([
      "MARCHE",
      "MARCHE",
    ]);
    expect((await visitWaypoints(dbB, path("B", "C"))).map((w) => w.modeSuivant)).toEqual([
      "MARCHE",
      "MARCHE",
    ]);
  });
});

describe("groupe de la réservation", () => {
  async function reservation(statut: "CONFIRMEE" | "ANNULEE", guide: boolean) {
    const client = await raw.utilisateur.create({
      data: {
        agenceId,
        prenom: "Lova",
        nom: "Rabe",
        email: `client-${Math.random()}@example.com`,
        motDePasseHash: "x",
        role: "CLIENT",
      },
    });
    const circuit = await raw.circuit.create({
      data: {
        agenceId,
        titre: "Sentier",
        slug: `sentier-${Math.random().toString(36).slice(2)}`,
        difficulte: "FACILE",
        dureeJours: 1,
        prixParPersonne: 1000,
        capaciteMax: 10,
      },
    });
    const guideRow = guide
      ? await raw.guide.create({ data: { agenceId, nom: "Guide", prenom: "G", langues: [] } })
      : null;
    const session = await raw.sessionDepart.create({
      data: {
        agenceId,
        circuitId: circuit.id,
        guideId: guideRow?.id ?? null,
        dateDebut: new Date("2026-12-20"),
        dateFin: new Date("2026-12-20"),
        placesTotal: 10,
      },
    });
    const r = await raw.reservation.create({
      data: {
        agenceId,
        reference: `GT-${Math.random().toString(36).slice(2, 8)}`,
        clientId: client.id,
        sessionId: session.id,
        nombrePersonnes: 3,
        montantTotal: 3000,
        statut,
      },
    });
    return { id: r.id, clientId: client.id };
  }

  it("le titulaire voit son groupe (nombre et guide), sans aucun nom", async () => {
    const r = await reservation("CONFIRMEE", true);
    expect(await visitParty(dbA, r.id, r.clientId)).toEqual({ personnes: 3, guide: true });
  });

  it("rien pour un autre client, une réservation annulée ou une autre agence", async () => {
    const r = await reservation("CONFIRMEE", false);
    const autre = await reservation("CONFIRMEE", false);
    expect(await visitParty(dbA, r.id, autre.clientId)).toBeNull();
    expect(await visitParty(dbB, r.id, r.clientId)).toBeNull();
    const annulee = await reservation("ANNULEE", false);
    expect(await visitParty(dbA, annulee.id, annulee.clientId)).toBeNull();
  });
});
