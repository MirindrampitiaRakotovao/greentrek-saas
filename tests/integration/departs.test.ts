import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { parseIsoDate } from "@/lib/departs";
import {
  cancelDepart,
  createDepart,
  deleteDepart,
  getDepart,
  listDeparts,
  refreshSessionStatut,
  updateDepart,
} from "@/lib/services/departs";
import { getTenantDb, type TenantDb } from "@/lib/tenant";
import type { DepartInput } from "@/lib/validators/departs";

import { createTestClient, truncateAll } from "./test-db";

/** Départs et disponibilités (étape E7). Date « du jour » fixée pour des tests stables. */
const raw = createTestClient();
const NOW = new Date("2026-09-29T09:00:00.000Z");

afterAll(async () => {
  await raw.$disconnect();
});

let agenceA: { id: string };
let agenceB: { id: string };
let dbA: TenantDb;
let dbB: TenantDb;
let circuitId: string;
let client: { id: string };

async function makeCircuit(
  agenceId: string,
  slug: string,
  statut: "PUBLIE" | "ARCHIVE" = "PUBLIE",
) {
  return raw.circuit.create({
    data: {
      agenceId,
      titre: `Circuit ${slug}`,
      slug,
      difficulte: "FACILE",
      dureeJours: 3,
      prixParPersonne: 150_000,
      capaciteMax: 10,
      statut,
    },
  });
}

async function makeGuide(agenceId: string, prenom: string, actif = true) {
  return raw.guide.create({ data: { agenceId, nom: "Test", prenom, langues: ["fr"], actif } });
}

const depart = (overrides: Partial<DepartInput> = {}): DepartInput => ({
  circuitId,
  dateDebut: "2026-10-10",
  dateFin: "2026-10-12",
  placesTotal: 8,
  prixParPersonne: null,
  guideId: null,
  notes: null,
  ...overrides,
});

function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

let refCounter = 0;
async function reserve(
  sessionId: string,
  nombrePersonnes: number,
  statut: "EN_ATTENTE" | "CONFIRMEE" | "ANNULEE" = "CONFIRMEE",
) {
  refCounter += 1;
  return raw.reservation.create({
    data: {
      agenceId: agenceA.id,
      reference: `T-${refCounter}`,
      clientId: client.id,
      sessionId,
      nombrePersonnes,
      montantTotal: nombrePersonnes * 150_000,
      statut,
    },
  });
}

beforeEach(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({ data: { nom: "Agence A", slug: "agence-a" } });
  agenceB = await raw.agence.create({ data: { nom: "Agence B", slug: "agence-b" } });
  dbA = getTenantDb(agenceA.id, raw);
  dbB = getTenantDb(agenceB.id, raw);
  circuitId = (await makeCircuit(agenceA.id, "c-a")).id;
  client = await raw.utilisateur.create({
    data: {
      agenceId: agenceA.id,
      nom: "Client",
      prenom: "Test",
      email: "client@a.test",
      motDePasseHash: "x",
      role: "CLIENT",
    },
  });
});

describe("création d'un départ", () => {
  it("crée un départ OUVERT, prix du circuit par défaut", async () => {
    const { id } = unwrap(await createDepart(dbA, agenceA.id, depart(), NOW));
    const detail = await getDepart(dbA, id, NOW);
    expect(detail?.statut).toBe("OUVERTE");
    expect(detail?.prix).toBe(150_000);
    expect(detail?.reservees).toBe(0);
  });

  it("le prix spécifique du départ remplace celui du circuit", async () => {
    const { id } = unwrap(
      await createDepart(dbA, agenceA.id, depart({ prixParPersonne: 120_000 }), NOW),
    );
    expect((await getDepart(dbA, id, NOW))?.prix).toBe(120_000);
  });

  it("refuse une date de début passée", async () => {
    const result = await createDepart(
      dbA,
      agenceA.id,
      depart({ dateDebut: "2026-09-28", dateFin: "2026-09-30" }),
      NOW,
    );
    expect(result).toMatchObject({ ok: false, field: "dateDebut" });
  });

  it("RG 10 : la base refuse une date de fin antérieure au début (contrainte CHECK)", async () => {
    const result = createDepart(
      dbA,
      agenceA.id,
      depart({ dateDebut: "2026-10-12", dateFin: "2026-10-10" }),
      NOW,
    );
    await expect(result).rejects.toThrow();
  });

  it("décision A : pas de départ pour un circuit archivé", async () => {
    const archive = await makeCircuit(agenceA.id, "c-arch", "ARCHIVE");
    const result = await createDepart(dbA, agenceA.id, depart({ circuitId: archive.id }), NOW);
    expect(result).toMatchObject({ ok: false, field: "circuitId" });
  });

  it("décision B : places ≤ capacité maximale du circuit", async () => {
    const result = await createDepart(dbA, agenceA.id, depart({ placesTotal: 11 }), NOW);
    expect(result).toMatchObject({ ok: false, field: "placesTotal" });
  });

  it("décision C : un guide ne peut pas encadrer deux départs qui se chevauchent", async () => {
    const guide = await makeGuide(agenceA.id, "Hery");
    unwrap(await createDepart(dbA, agenceA.id, depart({ guideId: guide.id }), NOW));
    // Même dernier jour : chevauchement.
    const conflit = await createDepart(
      dbA,
      agenceA.id,
      depart({ guideId: guide.id, dateDebut: "2026-10-12", dateFin: "2026-10-14" }),
      NOW,
    );
    expect(conflit).toMatchObject({ ok: false, field: "guideId" });
    // Le lendemain : accepté.
    const ok = await createDepart(
      dbA,
      agenceA.id,
      depart({ guideId: guide.id, dateDebut: "2026-10-13", dateFin: "2026-10-15" }),
      NOW,
    );
    expect(ok.ok).toBe(true);
  });

  it("un départ annulé ne bloque plus le guide ; un guide désactivé est refusé", async () => {
    const guide = await makeGuide(agenceA.id, "Hery");
    const { id } = unwrap(await createDepart(dbA, agenceA.id, depart({ guideId: guide.id }), NOW));
    unwrap(await cancelDepart(dbA, id, NOW));
    expect((await createDepart(dbA, agenceA.id, depart({ guideId: guide.id }), NOW)).ok).toBe(true);
    const inactif = await makeGuide(agenceA.id, "Soa", false);
    const refus = await createDepart(dbA, agenceA.id, depart({ guideId: inactif.id }), NOW);
    expect(refus).toMatchObject({ ok: false, field: "guideId" });
  });
});

describe("statut automatique (RG 11) et places (RG 13)", () => {
  it("COMPLETE quand toutes les places sont prises, OUVERTE à nouveau après annulation", async () => {
    const { id } = unwrap(await createDepart(dbA, agenceA.id, depart({ placesTotal: 5 }), NOW));
    const r1 = await reserve(id, 3);
    await reserve(id, 2, "EN_ATTENTE");
    expect(await refreshSessionStatut(dbA, id, NOW)).toBe("COMPLETE");
    await raw.reservation.update({ where: { id: r1.id }, data: { statut: "ANNULEE" } });
    expect(await refreshSessionStatut(dbA, id, NOW)).toBe("OUVERTE");
  });

  it("augmenter les places d'un départ complet le rouvre", async () => {
    const { id } = unwrap(await createDepart(dbA, agenceA.id, depart({ placesTotal: 4 }), NOW));
    await reserve(id, 4);
    await refreshSessionStatut(dbA, id, NOW);
    unwrap(await updateDepart(dbA, id, depart({ placesTotal: 6 }), NOW));
    expect((await getDepart(dbA, id, NOW))?.statut).toBe("OUVERTE");
  });

  it("RG 13 : impossible de descendre sous le nombre de places réservées", async () => {
    const { id } = unwrap(await createDepart(dbA, agenceA.id, depart(), NOW));
    await reserve(id, 5);
    await reserve(id, 2, "ANNULEE"); // les annulées ne comptent pas
    expect(await updateDepart(dbA, id, depart({ placesTotal: 4 }), NOW)).toMatchObject({
      ok: false,
      field: "placesTotal",
    });
    unwrap(await updateDepart(dbA, id, depart({ placesTotal: 5 }), NOW));
    expect((await getDepart(dbA, id, NOW))?.statut).toBe("COMPLETE");
  });

  it("un départ dont la date de fin est passée devient TERMINEE à l'affichage", async () => {
    const { id } = unwrap(await createDepart(dbA, agenceA.id, depart(), NOW));
    const later = new Date("2026-10-13T09:00:00.000Z");
    expect((await getDepart(dbA, id, later))?.statut).toBe("TERMINEE");
    expect(await updateDepart(dbA, id, depart(), later)).toMatchObject({ ok: false });
  });
});

describe("annulation et suppression", () => {
  it("décision D : l'annulation annule les réservations actives, dans la même transaction", async () => {
    const { id } = unwrap(await createDepart(dbA, agenceA.id, depart(), NOW));
    await reserve(id, 2, "CONFIRMEE");
    await reserve(id, 1, "EN_ATTENTE");
    await reserve(id, 1, "ANNULEE");
    const result = unwrap(await cancelDepart(dbA, id, NOW));
    expect(result.reservationsAnnulees).toBe(2);
    const reservations = await raw.reservation.findMany({ where: { sessionId: id } });
    expect(reservations.every((r) => r.statut === "ANNULEE")).toBe(true);
    expect(reservations.filter((r) => r.annuleeAt?.getTime() === NOW.getTime())).toHaveLength(2);
    expect((await getDepart(dbA, id, NOW))?.statut).toBe("ANNULEE");
    expect((await cancelDepart(dbA, id, NOW)).ok).toBe(false);
  });

  it("suppression seulement sans réservation", async () => {
    const vide = unwrap(await createDepart(dbA, agenceA.id, depart(), NOW));
    unwrap(await deleteDepart(dbA, vide.id));
    const plein = unwrap(await createDepart(dbA, agenceA.id, depart(), NOW));
    await reserve(plein.id, 1, "ANNULEE");
    expect((await deleteDepart(dbA, plein.id)).ok).toBe(false);
  });
});

describe("listes, filtres et vue du guide", () => {
  it("filtre à venir / passés, par statut ; le guide ne voit que ses départs", async () => {
    const guide = await makeGuide(agenceA.id, "Hery");
    unwrap(await createDepart(dbA, agenceA.id, depart({ guideId: guide.id }), NOW));
    const autre = unwrap(
      await createDepart(
        dbA,
        agenceA.id,
        depart({ dateDebut: "2026-11-01", dateFin: "2026-11-03" }),
        NOW,
      ),
    );
    // Départ passé, inséré directement (le service refuse une date passée).
    await raw.sessionDepart.create({
      data: {
        agenceId: agenceA.id,
        circuitId,
        dateDebut: parseIsoDate("2026-09-01"),
        dateFin: parseIsoDate("2026-09-03"),
        placesTotal: 5,
      },
    });
    unwrap(await cancelDepart(dbA, autre.id, NOW));

    const aVenir = await listDeparts(dbA, { periode: "a-venir" }, 1, NOW);
    expect(aVenir.total).toBe(2);
    const passes = await listDeparts(dbA, { periode: "passes" }, 1, NOW);
    expect(passes.items.map((d) => d.statut)).toEqual(["TERMINEE"]);
    const annules = await listDeparts(dbA, { periode: "tous", statut: "ANNULEE" }, 1, NOW);
    expect(annules.items.map((d) => d.id)).toEqual([autre.id]);
    const duGuide = await listDeparts(dbA, { periode: "tous", guideId: guide.id }, 1, NOW);
    expect(duGuide.total).toBe(1);
  });
});

describe("isolation entre agences (RG 20)", () => {
  it("l'agence B ne voit, ne modifie, n'annule ni ne supprime les départs de A", async () => {
    const { id } = unwrap(await createDepart(dbA, agenceA.id, depart(), NOW));
    expect(await getDepart(dbB, id, NOW)).toBeNull();
    expect((await listDeparts(dbB, { periode: "tous" }, 1, NOW)).total).toBe(0);
    expect((await updateDepart(dbB, id, depart(), NOW)).ok).toBe(false);
    expect((await cancelDepart(dbB, id, NOW)).ok).toBe(false);
    expect((await deleteDepart(dbB, id)).ok).toBe(false);
    expect((await getDepart(dbA, id, NOW))?.statut).toBe("OUVERTE");
  });

  it("B ne peut ni programmer un départ sur le circuit de A, ni y affecter un guide de A", async () => {
    const circuitB = await makeCircuit(agenceB.id, "c-b");
    const guideA = await makeGuide(agenceA.id, "Hery");
    expect((await createDepart(dbB, agenceB.id, depart(), NOW)).ok).toBe(false);
    const result = await createDepart(
      dbB,
      agenceB.id,
      depart({ circuitId: circuitB.id, guideId: guideA.id }),
      NOW,
    );
    expect(result).toMatchObject({ ok: false, field: "guideId" });
  });
});
