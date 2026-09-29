import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  addCircuitEtape,
  addCircuitPartenaire,
  createCircuit,
  deleteCircuit,
  getCircuit,
  moveCircuitEtape,
  removeCircuitEtape,
  setCircuitStatut,
  updateCircuit,
} from "@/lib/services/circuits";
import { createEtape, deleteEtape, getEtape, listEtapes, updateEtape } from "@/lib/services/etapes";
import { getTenantDb, TenantViolationError, type TenantDb } from "@/lib/tenant";
import type { CircuitInput, EtapeInput } from "@/lib/validators/circuits";

import { createTestClient, truncateAll } from "./test-db";

/** Circuits et étapes (étape E4). Coordonnées : valeurs de test, pas des relevés terrain. */
const raw = createTestClient();

afterAll(async () => {
  await raw.$disconnect();
});

let agenceA: { id: string };
let agenceB: { id: string };
let dbA: TenantDb;

const etape = (nom: string, latitude = 0): EtapeInput => ({
  nom,
  type: "VILLAGE",
  description: null,
  latitude,
  longitude: 0,
  altitudeM: null,
});

const circuit: CircuitInput = {
  titre: "Circuit test",
  slug: "circuit-test",
  resume: null,
  description: null,
  difficulte: "FACILE",
  dureeJours: 2,
  prixParPersonne: 100_000,
  capaciteMax: 10,
  imagePrincipaleUrl: null,
};

async function ids<T>(result: { ok: true; data: T } | { ok: false; error: string }): Promise<T> {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

async function setup() {
  const e1 = await ids(await createEtape(dbA, agenceA.id, etape("E1", 0.01)));
  const e2 = await ids(await createEtape(dbA, agenceA.id, etape("E2", 0.02)));
  const e3 = await ids(await createEtape(dbA, agenceA.id, etape("E3", 0.03)));
  const c = await ids(await createCircuit(dbA, agenceA.id, circuit));
  return { e1: e1.id, e2: e2.id, e3: e3.id, c: c.id };
}

const add = (circuitId: string, etapeId: string) =>
  addCircuitEtape(dbA, { circuitId, etapeId, jour: null, dureeSejourMin: null, notes: null });

async function order(circuitId: string) {
  const detail = await getCircuit(dbA, circuitId);
  return detail?.etapes.map((e) => `${e.ordre}:${e.etape.nom}`) ?? [];
}

beforeEach(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({ data: { nom: "Agence A", slug: "agence-a" } });
  agenceB = await raw.agence.create({ data: { nom: "Agence B", slug: "agence-b" } });
  dbA = getTenantDb(agenceA.id, raw);
});

describe("étapes (nœuds du graphe)", () => {
  it("crée, liste, déplace et modifie une étape", async () => {
    const { id } = await ids(await createEtape(dbA, agenceA.id, etape("Village")));
    await updateEtape(dbA, id, { latitude: -17.5, longitude: 49.4 });
    await expect(getEtape(dbA, id)).resolves.toMatchObject({ latitude: -17.5, longitude: 49.4 });
    await expect(listEtapes(dbA)).resolves.toHaveLength(1);
  });

  it("supprime une étape inutilisée", async () => {
    const { id } = await ids(await createEtape(dbA, agenceA.id, etape("Seule")));
    await expect(deleteEtape(dbA, id)).resolves.toMatchObject({ ok: true });
  });

  it("RG 8 : refuse de supprimer une étape utilisée par un circuit, avec un message clair", async () => {
    const { e1, c } = await setup();
    await add(c, e1);
    const result = await deleteEtape(dbA, e1);
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.error).toMatch(/étape\(s\) de circuit/);
  });

  it("RG 8 : refuse de supprimer une étape reliée par un tronçon", async () => {
    const { e1, e2 } = await setup();
    await raw.troncon.create({
      data: {
        agenceId: agenceA.id,
        etapeDepartId: e1,
        etapeArriveeId: e2,
        distanceKm: 1,
        dureeMinutes: 20,
        difficulte: 1,
      },
    });
    const result = await deleteEtape(dbA, e2);
    expect(!result.ok && result.error).toMatch(/tronçon/);
  });

  it("une étape d'une autre agence est invisible et non modifiable", async () => {
    const etapeB = await raw.etape.create({
      data: { agenceId: agenceB.id, nom: "B", type: "VILLAGE", latitude: 0, longitude: 0 },
    });
    await expect(getEtape(dbA, etapeB.id)).resolves.toBeNull();
    await expect(updateEtape(dbA, etapeB.id, { nom: "Piraté" })).resolves.toMatchObject({
      ok: false,
    });
  });
});

describe("circuits", () => {
  it("un nouveau circuit est un brouillon", async () => {
    const { c } = await setup();
    await expect(getCircuit(dbA, c)).resolves.toMatchObject({ statut: "BROUILLON" });
  });

  it("refuse un slug déjà utilisé dans l'agence, l'accepte dans une autre agence", async () => {
    await setup();
    await expect(createCircuit(dbA, agenceA.id, circuit)).resolves.toMatchObject({
      ok: false,
      field: "slug",
    });
    const dbB = getTenantDb(agenceB.id, raw);
    await expect(createCircuit(dbB, agenceB.id, circuit)).resolves.toMatchObject({ ok: true });
  });

  it("refuse de renommer le slug vers celui d'un autre circuit", async () => {
    await setup();
    const other = await ids(await createCircuit(dbA, agenceA.id, { ...circuit, slug: "autre" }));
    await expect(updateCircuit(dbA, other.id, circuit)).resolves.toMatchObject({
      ok: false,
      field: "slug",
    });
  });

  it("RG 4 : publication refusée sous deux étapes, acceptée à partir de deux", async () => {
    const { e1, e2, c } = await setup();
    await add(c, e1);
    await expect(setCircuitStatut(dbA, c, "PUBLIE")).resolves.toMatchObject({ ok: false });
    await add(c, e2);
    await expect(setCircuitStatut(dbA, c, "PUBLIE")).resolves.toMatchObject({ ok: true });
  });

  it("RG 4 : un circuit publié ne peut pas descendre sous deux étapes", async () => {
    const { e1, e2, c } = await setup();
    await add(c, e1);
    await add(c, e2);
    await setCircuitStatut(dbA, c, "PUBLIE");
    const first = (await getCircuit(dbA, c))!.etapes[0]!;
    await expect(removeCircuitEtape(dbA, first.id)).resolves.toMatchObject({ ok: false });
  });

  it("supprime un circuit sans départ, refuse s'il a des départs (archivage conseillé)", async () => {
    const { c } = await setup();
    const other = await ids(await createCircuit(dbA, agenceA.id, { ...circuit, slug: "autre" }));
    await raw.sessionDepart.create({
      data: {
        agenceId: agenceA.id,
        circuitId: other.id,
        dateDebut: new Date("2026-11-01"),
        dateFin: new Date("2026-11-01"),
        placesTotal: 5,
      },
    });
    await expect(deleteCircuit(dbA, c)).resolves.toMatchObject({ ok: true });
    await expect(deleteCircuit(dbA, other.id)).resolves.toMatchObject({ ok: false });
  });
});

describe("ordonnancement des étapes d'un circuit (RG 4 : rangs sans doublon)", () => {
  it("ajoute en fin de liste, rangs 1, 2, 3", async () => {
    const { e1, e2, e3, c } = await setup();
    await add(c, e1);
    await add(c, e2);
    await add(c, e3);
    await expect(order(c)).resolves.toEqual(["1:E1", "2:E2", "3:E3"]);
  });

  it("refuse la même étape deux fois de suite, accepte une boucle (retour au départ)", async () => {
    const { e1, e2, c } = await setup();
    await add(c, e1);
    await expect(add(c, e1)).resolves.toMatchObject({ ok: false, field: "etapeId" });
    await add(c, e2);
    await expect(add(c, e1)).resolves.toMatchObject({ ok: true });
    await expect(order(c)).resolves.toEqual(["1:E1", "2:E2", "3:E1"]);
  });

  it("monte et descend une étape (échange de rang, sans conflit d'index unique)", async () => {
    const { e1, e2, e3, c } = await setup();
    for (const e of [e1, e2, e3]) await add(c, e);
    const third = (await getCircuit(dbA, c))!.etapes[2]!;
    await moveCircuitEtape(dbA, third.id, "up");
    await expect(order(c)).resolves.toEqual(["1:E1", "2:E3", "3:E2"]);
    await moveCircuitEtape(dbA, third.id, "up");
    await expect(order(c)).resolves.toEqual(["1:E3", "2:E1", "3:E2"]);
    // Déjà en tête : rien ne change.
    await moveCircuitEtape(dbA, third.id, "up");
    await expect(order(c)).resolves.toEqual(["1:E3", "2:E1", "3:E2"]);
    await moveCircuitEtape(dbA, third.id, "down");
    await expect(order(c)).resolves.toEqual(["1:E1", "2:E3", "3:E2"]);
  });

  it("retire une étape et renumérote les suivantes sans trou", async () => {
    const { e1, e2, e3, c } = await setup();
    for (const e of [e1, e2, e3]) await add(c, e);
    const first = (await getCircuit(dbA, c))!.etapes[0]!;
    await removeCircuitEtape(dbA, first.id);
    await expect(order(c)).resolves.toEqual(["1:E2", "2:E3"]);
  });

  it("refuse d'ajouter une étape d'une autre agence (helper tenant)", async () => {
    const { c } = await setup();
    const etapeB = await raw.etape.create({
      data: { agenceId: agenceB.id, nom: "B", type: "VILLAGE", latitude: 0, longitude: 0 },
    });
    await expect(add(c, etapeB.id)).rejects.toThrow(TenantViolationError);
  });

  it("refuse d'ajouter une étape au circuit d'une autre agence", async () => {
    const { e1 } = await setup();
    const circuitB = await raw.circuit.create({
      data: { ...circuit, agenceId: agenceB.id },
    });
    await expect(add(circuitB.id, e1)).resolves.toMatchObject({ ok: false });
  });
});

describe("partenaires inclus dans un circuit", () => {
  it("ajoute une prestation d'un partenaire de l'agence, refuse un partenaire d'une autre agence", async () => {
    const { c, e1 } = await setup();
    const partenaire = await raw.partenaire.create({
      data: { agenceId: agenceA.id, nom: "P", type: "HEBERGEMENT" },
    });
    const partenaireB = await raw.partenaire.create({
      data: { agenceId: agenceB.id, nom: "PB", type: "HEBERGEMENT" },
    });
    const base = {
      circuitId: c,
      etapeId: e1,
      prestation: "Nuitée",
      prixUnitaire: null,
      inclusDansPrix: true,
    };
    await expect(
      addCircuitPartenaire(dbA, { ...base, partenaireId: partenaire.id }),
    ).resolves.toMatchObject({
      ok: true,
    });
    await expect(
      addCircuitPartenaire(dbA, { ...base, partenaireId: partenaireB.id }),
    ).rejects.toThrow(TenantViolationError);
    await expect(getCircuit(dbA, c)).resolves.toMatchObject({
      partenaires: [expect.objectContaining({ prestation: "Nuitée" })],
    });
  });
});
