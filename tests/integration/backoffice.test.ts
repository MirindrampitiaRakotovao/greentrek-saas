import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getAgencySettings, updateAgencySettings } from "@/lib/services/agency-settings";
import {
  createGuide,
  deleteGuide,
  getGuide,
  listGuides,
  listLinkableGuideAccounts,
  updateGuide,
} from "@/lib/services/guides";
import {
  createPartenaire,
  deletePartenaire,
  getPartenaire,
  listPartenaires,
  updatePartenaire,
} from "@/lib/services/partenaires";
import { getTenantDb, type TenantDb } from "@/lib/tenant";
import type { GuideInput, PartenaireInput } from "@/lib/validators/backoffice";

import { createTestClient, truncateAll } from "./test-db";

/** Paramètres, partenaires et guides (étape E3b). Données fictives. */
const raw = createTestClient();

afterAll(async () => {
  await raw.$disconnect();
});

let agenceA: { id: string };
let agenceB: { id: string };
let dbA: TenantDb;

beforeEach(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({ data: { nom: "Agence A", slug: "agence-a" } });
  agenceB = await raw.agence.create({ data: { nom: "Agence B", slug: "agence-b" } });
  dbA = getTenantDb(agenceA.id, raw);
});

const partenaire: PartenaireInput = {
  nom: "Partenaire test",
  type: "HEBERGEMENT",
  description: null,
  telephone: null,
  email: null,
  adresse: null,
  latitude: null,
  longitude: null,
  tarifIndicatif: 30_000,
  actif: true,
};

const guide: GuideInput = {
  prenom: "Guide",
  nom: "Test",
  telephone: null,
  bio: null,
  langues: ["fr", "mg"],
  experienceAnnees: 5,
  actif: true,
  utilisateurId: null,
};

async function createCircuit(agenceId: string) {
  return raw.circuit.create({
    data: {
      agenceId,
      titre: "Circuit",
      slug: "circuit",
      difficulte: "FACILE",
      dureeJours: 1,
      prixParPersonne: 1,
      capaciteMax: 5,
    },
  });
}

async function createGuideAccount(agenceId: string, email: string, role: "GUIDE" | "STAFF") {
  return raw.utilisateur.create({
    data: { agenceId, email, role, nom: "Compte", prenom: role, motDePasseHash: "x" },
  });
}

describe("paramètres de l'agence", () => {
  it("lit et met à jour les paramètres de SON agence uniquement", async () => {
    await updateAgencySettings(dbA, agenceA.id, {
      nom: "Agence A modifiée",
      description: "Description",
      email: "contact@a.test",
      telephone: null,
      adresse: null,
      ville: "Mahambo",
      pays: "Madagascar",
      devise: "EUR",
      logoUrl: null,
    });
    await expect(getAgencySettings(dbA, agenceA.id)).resolves.toMatchObject({
      nom: "Agence A modifiée",
      devise: "EUR",
      slug: "agence-a",
    });
  });

  it("ne peut pas modifier une autre agence, même en passant son identifiant", async () => {
    const result = await updateAgencySettings(dbA, agenceB.id, {
      nom: "Piratée",
      description: null,
      email: null,
      telephone: null,
      adresse: null,
      ville: null,
      pays: null,
      devise: "MGA",
      logoUrl: null,
    });
    expect(result.ok).toBe(false);
    await expect(
      raw.agence.findUniqueOrThrow({ where: { id: agenceB.id } }),
    ).resolves.toMatchObject({ nom: "Agence B" });
  });
});

describe("partenaires", () => {
  it("crée, liste et modifie un partenaire de l'agence", async () => {
    const created = await createPartenaire(dbA, agenceA.id, partenaire);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await updatePartenaire(dbA, created.data.id, { ...partenaire, nom: "Renommé", actif: false });
    await expect(getPartenaire(dbA, created.data.id)).resolves.toMatchObject({
      nom: "Renommé",
      actif: false,
    });
    const list = await listPartenaires(dbA, 1);
    expect(list.total).toBe(1);
  });

  it("un partenaire d'une autre agence est introuvable, non modifiable, non supprimable", async () => {
    const partenaireB = await raw.partenaire.create({
      data: { agenceId: agenceB.id, nom: "B", type: "ACTIVITE" },
    });
    await expect(getPartenaire(dbA, partenaireB.id)).resolves.toBeNull();
    await expect(updatePartenaire(dbA, partenaireB.id, partenaire)).resolves.toMatchObject({
      ok: false,
    });
    await expect(deletePartenaire(dbA, partenaireB.id)).resolves.toMatchObject({ ok: false });
    await expect(raw.partenaire.count({ where: { id: partenaireB.id } })).resolves.toBe(1);
  });

  it("supprime un partenaire inutilisé", async () => {
    const created = await createPartenaire(dbA, agenceA.id, partenaire);
    if (!created.ok) throw new Error("création échouée");
    await expect(deletePartenaire(dbA, created.data.id)).resolves.toMatchObject({ ok: true });
    await expect(raw.partenaire.count()).resolves.toBe(0);
  });

  it("refuse de supprimer un partenaire inclus dans un circuit (désactivation conseillée)", async () => {
    const created = await createPartenaire(dbA, agenceA.id, partenaire);
    if (!created.ok) throw new Error("création échouée");
    const circuit = await createCircuit(agenceA.id);
    await raw.circuitPartenaire.create({
      data: { circuitId: circuit.id, partenaireId: created.data.id, prestation: "Nuitée" },
    });
    const result = await deletePartenaire(dbA, created.data.id);
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.error).toMatch(/désactivez/);
    await expect(raw.partenaire.count()).resolves.toBe(1);
  });
});

describe("guides", () => {
  it("crée une fiche sans compte, avec ses langues", async () => {
    const created = await createGuide(dbA, agenceA.id, guide);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await expect(getGuide(dbA, created.data.id)).resolves.toMatchObject({
      langues: ["fr", "mg"],
      experienceAnnees: 5,
      utilisateurId: null,
    });
    await expect(listGuides(dbA, 1)).resolves.toMatchObject({ total: 1 });
  });

  it("relie une fiche à un compte GUIDE sans fiche", async () => {
    const compte = await createGuideAccount(agenceA.id, "guide@a.test", "GUIDE");
    await expect(listLinkableGuideAccounts(dbA)).resolves.toHaveLength(1);
    const created = await createGuide(dbA, agenceA.id, { ...guide, utilisateurId: compte.id });
    expect(created.ok).toBe(true);
    // Le compte n'est plus proposé pour une autre fiche.
    await expect(listLinkableGuideAccounts(dbA)).resolves.toHaveLength(0);
  });

  it("refuse de relier un compte qui n'est pas GUIDE", async () => {
    const staff = await createGuideAccount(agenceA.id, "staff@a.test", "STAFF");
    await expect(
      createGuide(dbA, agenceA.id, { ...guide, utilisateurId: staff.id }),
    ).resolves.toMatchObject({ ok: false, field: "utilisateurId" });
  });

  it("refuse de relier un compte déjà relié à une autre fiche", async () => {
    const compte = await createGuideAccount(agenceA.id, "guide@a.test", "GUIDE");
    await createGuide(dbA, agenceA.id, { ...guide, utilisateurId: compte.id });
    await expect(
      createGuide(dbA, agenceA.id, { ...guide, prenom: "Autre", utilisateurId: compte.id }),
    ).resolves.toMatchObject({ ok: false, field: "utilisateurId" });
  });

  it("refuse de relier un compte GUIDE d'une autre agence", async () => {
    const compteB = await createGuideAccount(agenceB.id, "guide@b.test", "GUIDE");
    await expect(
      createGuide(dbA, agenceA.id, { ...guide, utilisateurId: compteB.id }),
    ).resolves.toMatchObject({ ok: false, field: "utilisateurId" });
  });

  it("modifie une fiche et peut retirer le lien au compte", async () => {
    const compte = await createGuideAccount(agenceA.id, "guide@a.test", "GUIDE");
    const created = await createGuide(dbA, agenceA.id, { ...guide, utilisateurId: compte.id });
    if (!created.ok) throw new Error("création échouée");
    await expect(
      updateGuide(dbA, created.data.id, { ...guide, bio: "Bio", utilisateurId: compte.id }),
    ).resolves.toMatchObject({ ok: true });
    await updateGuide(dbA, created.data.id, { ...guide, utilisateurId: null });
    await expect(getGuide(dbA, created.data.id)).resolves.toMatchObject({ utilisateurId: null });
  });

  it("refuse de supprimer une fiche qui encadre un départ", async () => {
    const created = await createGuide(dbA, agenceA.id, guide);
    if (!created.ok) throw new Error("création échouée");
    const circuit = await createCircuit(agenceA.id);
    await raw.sessionDepart.create({
      data: {
        agenceId: agenceA.id,
        circuitId: circuit.id,
        guideId: created.data.id,
        dateDebut: new Date("2026-11-10"),
        dateFin: new Date("2026-11-11"),
        placesTotal: 5,
      },
    });
    await expect(deleteGuide(dbA, created.data.id)).resolves.toMatchObject({ ok: false });
  });

  it("refuse de supprimer une fiche reliée à un compte, supprime une fiche libre", async () => {
    const compte = await createGuideAccount(agenceA.id, "guide@a.test", "GUIDE");
    const linked = await createGuide(dbA, agenceA.id, { ...guide, utilisateurId: compte.id });
    const free = await createGuide(dbA, agenceA.id, { ...guide, prenom: "Libre" });
    if (!linked.ok || !free.ok) throw new Error("création échouée");
    await expect(deleteGuide(dbA, linked.data.id)).resolves.toMatchObject({ ok: false });
    await expect(deleteGuide(dbA, free.data.id)).resolves.toMatchObject({ ok: true });
  });

  it("une fiche d'une autre agence est introuvable", async () => {
    const guideB = await raw.guide.create({
      data: { agenceId: agenceB.id, nom: "B", prenom: "Guide", langues: [] },
    });
    await expect(getGuide(dbA, guideB.id)).resolves.toBeNull();
    await expect(deleteGuide(dbA, guideB.id)).resolves.toMatchObject({ ok: false });
  });
});
