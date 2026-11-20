import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { parseIsoDate } from "@/lib/departs";
import {
  addCommentaire,
  createPublication,
  deleteCommentaire,
  deletePublication,
  dismissReport,
  getPublication,
  hideReportedContent,
  communityActivity,
  listCommunityReports,
  listDestinations,
  listFeed,
  myCommunityStats,
  readPhotos,
  listSejoursPartageables,
  reportContent,
  restoreReportedContent,
  setJaime,
} from "@/lib/services/communaute";
import { getTenantDb, TenantViolationError } from "@/lib/tenant";

import { COMMUNAUTE_PHOTOS } from "../../prisma/communaute-photos";
import { seedCommunaute } from "../../prisma/seed-communaute";

import { createTestClient, truncateAll } from "./test-db";

/**
 * Communauté (étape 5d) : fil commun aux agences, publication après un séjour terminé,
 * « J'aime », commentaires, signalement et modération par le super admin ; tables de la
 * plateforme interdites au client d'une agence.
 */
const raw = createTestClient();
const PHOTO = "/fichiers/publications/0f8fad5b-d9cb-469f-a165-70867728950e.webp";

afterAll(async () => {
  await raw.$disconnect();
});

let agenceA: { id: string };
let agenceB: { id: string };
let lova: string;
let bao: string;
let sejourLova: string;
let sejourAVenir: string;

async function client(agenceId: string, email: string, prenom: string) {
  return (
    await raw.utilisateur.create({
      data: { agenceId, email, prenom, nom: "Rabe", motDePasseHash: "x", role: "CLIENT" },
    })
  ).id;
}

async function reservation(
  agenceId: string,
  clientId: string,
  statut: "TERMINEE" | "CONFIRMEE",
  ref: string,
) {
  const circuit = await raw.circuit.create({
    data: {
      agenceId,
      titre: `Sentier ${ref}`,
      slug: `sentier-${ref.toLowerCase()}`,
      difficulte: "FACILE",
      dureeJours: 1,
      prixParPersonne: 100_000,
      capaciteMax: 8,
      statut: "PUBLIE",
    },
  });
  const d = parseIsoDate("2026-10-01");
  const session = await raw.sessionDepart.create({
    data: { agenceId, circuitId: circuit.id, dateDebut: d, dateFin: d, placesTotal: 8 },
  });
  return (
    await raw.reservation.create({
      data: {
        agenceId,
        reference: ref,
        clientId,
        sessionId: session.id,
        nombrePersonnes: 1,
        montantTotal: 100_000,
        statut,
      },
    })
  ).id;
}

const publish = (auteur = lova, reservationId = sejourLova) =>
  createPublication(
    auteur,
    { reservationId, legende: "Lever du soleil", photos: [PHOTO] },
    new Date(),
    raw,
  );

beforeEach(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({ data: { nom: "Agence A", slug: "a" } });
  agenceB = await raw.agence.create({ data: { nom: "Agence B", slug: "b" } });
  lova = await client(agenceA.id, "lova@example.com", "Lova");
  bao = await client(agenceB.id, "bao@example.com", "Bao");
  sejourLova = await reservation(agenceA.id, lova, "TERMINEE", "R-1");
  sejourAVenir = await reservation(agenceA.id, lova, "CONFIRMEE", "R-2");
});

describe("publier", () => {
  it("après un séjour terminé seulement, le sien, avec au moins une photo", async () => {
    expect((await listSejoursPartageables(lova, raw)).map((s) => s.id)).toEqual([sejourLova]);
    expect(await publish(lova, sejourAVenir)).toMatchObject({ ok: false, field: "reservationId" });
    expect(await publish(bao, sejourLova)).toEqual({
      ok: false,
      error: "Séjour introuvable.",
      field: "reservationId",
    });
    expect(
      await createPublication(
        lova,
        { reservationId: sejourLova, legende: null, photos: [] },
        new Date(),
        raw,
      ),
    ).toMatchObject({ ok: false, field: "photos" });
    expect((await publish()).ok).toBe(true);
  });

  it("le fil est commun à toutes les agences ; prénom, initiale, agence ; jamais l'e-mail", async () => {
    const res = await publish();
    const feed = await listFeed(bao, 1, raw);
    expect(feed.total).toBe(1);
    expect(feed.items[0]).toMatchObject({
      id: res.ok ? res.data.id : "",
      auteur: { nom: "Lova R." },
      agence: { nom: "Agence A", slug: "a" },
      circuit: { titre: "Sentier R-1", slug: "sentier-r-1" },
      photos: [PHOTO],
      deMoi: false,
    });
    expect(JSON.stringify(feed)).not.toContain("@example.com");
  });

  it("le client d'une agence n'a aucun accès aux tables de la communauté", async () => {
    await publish();
    const dbA = getTenantDb(agenceA.id, raw);
    await expect(dbA.publication.findMany()).rejects.toBeInstanceOf(TenantViolationError);
    await expect(dbA.signalementCommunaute.count()).rejects.toBeInstanceOf(TenantViolationError);
  });

  it("agence suspendue ou compte désactivé : publications retirées du fil", async () => {
    await publish();
    await raw.agence.update({ where: { id: agenceA.id }, data: { statut: "SUSPENDUE" } });
    expect((await listFeed(bao, 1, raw)).total).toBe(0);
    await raw.agence.update({ where: { id: agenceA.id }, data: { statut: "ACTIVE" } });
    await raw.utilisateur.update({ where: { id: lova }, data: { actif: false } });
    expect((await listFeed(bao, 1, raw)).total).toBe(0);
  });
});

describe("réagir", () => {
  it("J'aime une fois par voyageur ; commentaires ; suppression de ses seuls contenus", async () => {
    const res = await publish();
    const id = res.ok ? res.data.id : "";
    expect(await setJaime(bao, id, true, raw)).toEqual({ ok: true, data: { jaimes: 1 } });
    expect(await setJaime(bao, id, true, raw)).toEqual({ ok: true, data: { jaimes: 1 } });
    expect((await listFeed(bao, 1, raw)).items[0]).toMatchObject({ jaimes: 1, jAime: true });
    const com = await addCommentaire(
      bao,
      { publicationId: id, contenu: "Magnifique !" },
      new Date(),
      raw,
    );
    const comId = com.ok ? com.data.id : "";
    const detail = await getPublication(lova, id, raw);
    expect(detail?.listeCommentaires).toMatchObject([
      { contenu: "Magnifique !", auteur: { nom: "Bao R." }, deMoi: false },
    ]);
    // Personne d'autre ne supprime le commentaire ou la publication.
    expect((await deleteCommentaire(lova, comId, raw)).ok).toBe(false);
    expect((await deletePublication(bao, id, raw)).ok).toBe(false);
    expect((await deleteCommentaire(bao, comId, raw)).ok).toBe(true);
    expect(await deletePublication(lova, id, raw)).toEqual({ ok: true, data: { photos: [PHOTO] } });
    expect(await raw.jaime.count()).toBe(0);
  });
});

describe("signaler et modérer (super admin)", () => {
  it("signalement d'un contenu d'un autre voyageur, une fois ; masquer puis rétablir", async () => {
    const res = await publish();
    const id = res.ok ? res.data.id : "";
    expect(
      (await reportContent(lova, { cible: "PUBLICATION", cibleId: id, motif: null }, raw)).ok,
    ).toBe(false);
    expect(
      (await reportContent(bao, { cible: "PUBLICATION", cibleId: id, motif: "Hors sujet" }, raw))
        .ok,
    ).toBe(true);
    expect(
      await reportContent(bao, { cible: "PUBLICATION", cibleId: id, motif: null }, raw),
    ).toEqual({
      ok: false,
      error: "Vous avez déjà signalé ce contenu.",
    });
    const [s] = (await listCommunityReports("OUVERT", 1, raw)).items;
    expect(s).toMatchObject({
      signalePar: "Bao R.",
      motif: "Hors sujet",
      contenu: { texte: "Lever du soleil", auteur: "Lova Rabe (Agence A)", statut: "VISIBLE" },
    });

    await hideReportedContent(s!.id, new Date(), raw);
    expect((await listFeed(bao, 1, raw)).total).toBe(0);
    expect(await getPublication(lova, id, raw)).toBeNull();
    expect((await listCommunityReports("OUVERT", 1, raw)).total).toBe(0);
    await restoreReportedContent(s!.id, raw);
    expect((await listFeed(bao, 1, raw)).total).toBe(1);
  });

  it("commentaire signalé : classé sans suite, il reste visible", async () => {
    const res = await publish();
    const id = res.ok ? res.data.id : "";
    const com = await addCommentaire(
      lova,
      { publicationId: id, contenu: "Merci !" },
      new Date(),
      raw,
    );
    const cibleId = com.ok ? com.data.id : "";
    await reportContent(bao, { cible: "COMMENTAIRE", cibleId, motif: null }, raw);
    const [s] = (await listCommunityReports(undefined, 1, raw)).items;
    expect(await dismissReport(s!.id, new Date(), raw)).toEqual({ ok: true, data: undefined });
    expect((await getPublication(bao, id, raw))?.listeCommentaires).toHaveLength(1);
  });
});

describe("fil : tri, filtres, destinations, chiffres (étape 5e)", () => {
  it("« Populaires » d'abord le plus aimé ; filtres destination, recherche, mes publications", async () => {
    const a = await publish();
    const lova2 = await reservation(agenceA.id, lova, "TERMINEE", "R-3");
    const b = await createPublication(
      lova,
      { reservationId: lova2, legende: "Pirogue au lever du jour", photos: [PHOTO] },
      new Date(Date.now() + 1000),
      raw,
    );
    const sejourBao = await reservation(agenceB.id, bao, "TERMINEE", "B-1");
    await createPublication(
      bao,
      { reservationId: sejourBao, legende: null, photos: [PHOTO] },
      new Date(),
      raw,
    );
    const idA = a.ok ? a.data.id : "";
    const idB = b.ok ? b.data.id : "";
    await setJaime(bao, idA, true, raw);

    expect((await listFeed(bao, 1, raw, { tri: "recentes" })).items[0]?.id).toBe(idB);
    expect((await listFeed(bao, 1, raw, { tri: "populaires" })).items[0]?.id).toBe(idA);
    const circuitB = (await listFeed(bao, 1, raw)).items.find((p) => p.id === idB)!.circuit.id;
    expect((await listFeed(bao, 1, raw, { circuit: circuitB })).items.map((p) => p.id)).toEqual([
      idB,
    ]);
    expect((await listFeed(bao, 1, raw, { q: "pirogue" })).items.map((p) => p.id)).toEqual([idB]);
    expect((await listFeed(bao, 1, raw, { q: "Agence B" })).total).toBe(1);
    expect((await listFeed(lova, 1, raw, { moi: "1" })).total).toBe(2);

    const destinations = await listDestinations(12, raw);
    expect(destinations).toHaveLength(3);
    expect(destinations.every((d) => d.photo === PHOTO && d.publications === 1)).toBe(true);
    expect(await myCommunityStats(lova, raw)).toEqual({
      publications: 2,
      jaimes: 1,
      commentaires: 0,
    });
    expect(await communityActivity(raw)).toEqual({ publications: 3, voyageurs: 2, agences: 2 });
  });

  it("photos acceptées : envoyées par un voyageur ou livrées avec le projet, rien d'autre", () => {
    expect(readPhotos([PHOTO, "/images/communaute/isalo-01.jpg"])).toHaveLength(2);
    expect(readPhotos(["https://exemple.org/x.jpg"])).toEqual([]);
    expect(readPhotos(["/images/communaute/../../.env"])).toEqual([]);
  });
});

describe("publications de départ (seed de la communauté)", () => {
  it("photos du circuit, après le séjour, rejouable sans toucher aux vraies publications", async () => {
    const lacs = await raw.circuit.create({
      data: {
        agenceId: agenceA.id,
        titre: "Lacs et volcans",
        slug: "lacs-et-volcans",
        difficulte: "FACILE",
        dureeJours: 1,
        prixParPersonne: 100_000,
        capaciteMax: 8,
        statut: "PUBLIE",
      },
    });
    const fin = new Date("2026-09-01T00:00:00.000Z");
    const session = await raw.sessionDepart.create({
      data: {
        agenceId: agenceA.id,
        circuitId: lacs.id,
        dateDebut: fin,
        dateFin: fin,
        placesTotal: 8,
      },
    });
    await raw.reservation.create({
      data: {
        agenceId: agenceA.id,
        reference: "R-LACS",
        clientId: lova,
        sessionId: session.id,
        nombrePersonnes: 1,
        montantTotal: 100_000,
        statut: "TERMINEE",
      },
    });
    const vraie = await publish();
    const now = new Date("2026-11-20T08:00:00.000Z");

    const r1 = await seedCommunaute(raw, now);
    expect(r1.publications).toBe(6);
    const pool = new Set(
      COMMUNAUTE_PHOTOS.filter((p) => p.circuits.includes("lacs-et-volcans")).map((p) => p.photo),
    );
    const seeded = await raw.publication.findMany({
      where: { id: { not: vraie.ok ? vraie.data.id : "" } },
      select: { photos: true, createdAt: true, auteurId: true },
    });
    for (const p of seeded) {
      const photos = readPhotos(p.photos);
      expect(photos.length).toBeGreaterThan(0);
      expect(photos.every((src) => pool.has(src))).toBe(true);
      expect(new Set(photos).size).toBe(photos.length);
      expect(p.createdAt.getTime()).toBeGreaterThan(fin.getTime());
      expect(p.createdAt.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(p.auteurId).toBe(lova);
    }
    const r2 = await seedCommunaute(raw, now);
    expect(r2.supprimees).toBe(6);
    expect(await raw.publication.count()).toBe(7);
    expect(await raw.publication.count({ where: { id: vraie.ok ? vraie.data.id : "" } })).toBe(1);
  });
});
