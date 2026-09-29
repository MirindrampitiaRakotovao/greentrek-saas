import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { deleteEtape } from "@/lib/services/etapes";
import {
  createTroncon,
  deleteTroncon,
  getTroncon,
  listTroncons,
  updateTroncon,
} from "@/lib/services/troncons";
import { getTenantDb, TenantViolationError, type TenantDb } from "@/lib/tenant";
import { tronconSchema, type TronconInput } from "@/lib/validators/circuits";

import { createTestClient, truncateAll } from "./test-db";

/** Tronçons, arêtes du graphe (étape E5). Coordonnées : valeurs de test. */
const raw = createTestClient();

afterAll(async () => {
  await raw.$disconnect();
});

let agenceA: { id: string };
let agenceB: { id: string };
let dbA: TenantDb;
let a: string;
let b: string;
let c: string;

const troncon = (
  depart: string,
  arrivee: string,
  overrides: Partial<TronconInput> = {},
): TronconInput => ({
  etapeDepartId: depart,
  etapeArriveeId: arrivee,
  distanceKm: 2.5,
  dureeMinutes: 40,
  deniveleM: null,
  difficulte: 2,
  bidirectionnel: true,
  distanceEstimee: true,
  commentaire: null,
  ...overrides,
});

async function etape(agenceId: string, nom: string) {
  const created = await raw.etape.create({
    data: { agenceId, nom, type: "VILLAGE", latitude: 0, longitude: 0 },
  });
  return created.id;
}

beforeEach(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({ data: { nom: "Agence A", slug: "agence-a" } });
  agenceB = await raw.agence.create({ data: { nom: "Agence B", slug: "agence-b" } });
  dbA = getTenantDb(agenceA.id, raw);
  a = await etape(agenceA.id, "A");
  b = await etape(agenceA.id, "B");
  c = await etape(agenceA.id, "C");
});

describe("création et validation", () => {
  it("crée un tronçon entre deux étapes de l'agence", async () => {
    await expect(createTroncon(dbA, agenceA.id, troncon(a, b))).resolves.toMatchObject({
      ok: true,
    });
    await expect(listTroncons(dbA)).resolves.toHaveLength(1);
  });

  it("RG 6 : le schéma refuse un départ égal à l'arrivée (message sur le champ arrivée)", () => {
    const result = tronconSchema.safeParse(troncon(a, a));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["etapeArriveeId"]);
  });

  it("RG 6 : le schéma refuse une distance nulle et une difficulté hors 1 à 5", () => {
    expect(tronconSchema.safeParse(troncon(a, b, { distanceKm: 0 })).success).toBe(false);
    expect(tronconSchema.safeParse(troncon(a, b, { difficulte: 6 })).success).toBe(false);
  });

  it("RG 6 : un tronçon vers une étape d'une autre agence est refusé (helper tenant)", async () => {
    const etapeB = await etape(agenceB.id, "B d'une autre agence");
    await expect(createTroncon(dbA, agenceA.id, troncon(a, etapeB))).rejects.toThrow(
      TenantViolationError,
    );
  });
});

describe("doublons", () => {
  it("RG 7 : refuse un second tronçon dans le même sens", async () => {
    await createTroncon(dbA, agenceA.id, troncon(a, b));
    await expect(createTroncon(dbA, agenceA.id, troncon(a, b))).resolves.toMatchObject({
      ok: false,
      field: "etapeArriveeId",
    });
  });

  it("doublon inverse : refuse B→A si A→B est à double sens", async () => {
    await createTroncon(dbA, agenceA.id, troncon(a, b));
    await expect(
      createTroncon(dbA, agenceA.id, troncon(b, a, { bidirectionnel: false })),
    ).resolves.toMatchObject({ ok: false });
  });

  it("doublon inverse : refuse B→A à double sens même si A→B est à sens unique", async () => {
    await createTroncon(dbA, agenceA.id, troncon(a, b, { bidirectionnel: false }));
    await expect(createTroncon(dbA, agenceA.id, troncon(b, a))).resolves.toMatchObject({
      ok: false,
    });
  });

  it("accepte A→B et B→A tous deux à sens unique (ex. montée et descente)", async () => {
    await createTroncon(
      dbA,
      agenceA.id,
      troncon(a, b, { bidirectionnel: false, dureeMinutes: 60 }),
    );
    await expect(
      createTroncon(dbA, agenceA.id, troncon(b, a, { bidirectionnel: false, dureeMinutes: 35 })),
    ).resolves.toMatchObject({ ok: true });
  });
});

describe("modification et suppression", () => {
  it("modifie un tronçon (mesure de terrain : distance saisie, plus estimée)", async () => {
    const created = await createTroncon(dbA, agenceA.id, troncon(a, b));
    if (!created.ok) throw new Error(created.error);
    await expect(
      updateTroncon(
        dbA,
        created.data.id,
        troncon(a, b, { distanceKm: 3.2, distanceEstimee: false }),
      ),
    ).resolves.toMatchObject({ ok: true });
    await expect(getTroncon(dbA, created.data.id)).resolves.toMatchObject({
      distanceKm: 3.2,
      distanceEstimee: false,
    });
  });

  it("la modification ne se compte pas elle-même comme doublon, mais détecte les autres", async () => {
    const ab = await createTroncon(dbA, agenceA.id, troncon(a, b));
    await createTroncon(dbA, agenceA.id, troncon(a, c));
    if (!ab.ok) throw new Error(ab.error);
    await expect(
      updateTroncon(dbA, ab.data.id, troncon(a, b, { difficulte: 4 })),
    ).resolves.toMatchObject({ ok: true });
    await expect(updateTroncon(dbA, ab.data.id, troncon(a, c))).resolves.toMatchObject({
      ok: false,
    });
  });

  it("supprime un tronçon ; l'étape redevient supprimable (RG 8)", async () => {
    const created = await createTroncon(dbA, agenceA.id, troncon(a, b));
    if (!created.ok) throw new Error(created.error);
    await expect(deleteEtape(dbA, a)).resolves.toMatchObject({ ok: false });
    await deleteTroncon(dbA, created.data.id);
    await expect(deleteEtape(dbA, a)).resolves.toMatchObject({ ok: true });
  });

  it("un tronçon d'une autre agence est invisible et non supprimable", async () => {
    const x = await etape(agenceB.id, "X");
    const y = await etape(agenceB.id, "Y");
    const tronconB = await raw.troncon.create({
      data: { ...troncon(x, y), agenceId: agenceB.id },
    });
    await expect(getTroncon(dbA, tronconB.id)).resolves.toBeNull();
    await expect(deleteTroncon(dbA, tronconB.id)).resolves.toMatchObject({ ok: false });
    await expect(raw.troncon.count({ where: { id: tronconB.id } })).resolves.toBe(1);
  });
});
