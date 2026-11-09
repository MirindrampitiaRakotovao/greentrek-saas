import bcrypt from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { Role } from "@/generated/prisma/client";
import { parseIsoDate } from "@/lib/departs";
import { mobileClientFromRequest, mobileLogin } from "@/lib/mobile/session";
import { getCatalogueCircuit, listCatalogue } from "@/lib/services/catalogue";

import { createTestClient, truncateAll } from "./test-db";

/** API de l'application mobile (après E12) : catalogue, fiche, connexion, jeton. */
const raw = createTestClient();
const NOW = new Date("2026-11-09T09:00:00.000Z");
const PASSWORD = "Voyage2026";

afterAll(async () => {
  await raw.$disconnect();
});

let agenceA: { id: string; slug: string };
let agenceB: { id: string; slug: string };

async function circuit(
  agenceId: string,
  slug: string,
  titre: string,
  statut: "PUBLIE" | "BROUILLON" = "PUBLIE",
  difficulte: "FACILE" | "MOYENNE" | "DIFFICILE" = "FACILE",
) {
  return raw.circuit.create({
    data: {
      agenceId,
      titre,
      slug,
      difficulte,
      dureeJours: 1,
      prixParPersonne: 100_000,
      capaciteMax: 10,
      statut,
      resume: `Résumé de ${titre}`,
    },
  });
}

async function depart(agenceId: string, circuitId: string, debut: string, places = 8) {
  const dateDebut = parseIsoDate(debut);
  return raw.sessionDepart.create({
    data: { agenceId, circuitId, dateDebut, dateFin: dateDebut, placesTotal: places },
  });
}

async function user(email: string, role: Role, agenceId: string, actif = true) {
  return raw.utilisateur.create({
    data: {
      agenceId,
      prenom: "Hery",
      nom: "Test",
      email,
      motDePasseHash: await bcrypt.hash(PASSWORD, 4),
      role,
      actif,
    },
  });
}

const request = (token?: string) =>
  new Request("http://localhost/api/mobile/v1/moi", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

beforeEach(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({
    data: { nom: "Green Trek Mada", slug: "green-trek-mada", ville: "Mahambo" },
  });
  agenceB = await raw.agence.create({
    data: { nom: "Tanety Trek", slug: "tanety-trek", ville: "Antsirabe" },
  });
});

describe("catalogue", () => {
  it("circuits publiés de toutes les agences actives, départ le plus proche d'abord", async () => {
    const a = await circuit(agenceA.id, "sentier", "Sentier côtier");
    const b = await circuit(agenceB.id, "lacs", "Lacs et volcans", "PUBLIE", "MOYENNE");
    await circuit(agenceA.id, "brouillon", "Circuit en préparation", "BROUILLON");
    await depart(agenceA.id, a.id, "2026-12-20");
    await depart(agenceB.id, b.id, "2026-11-25");

    const { agences, circuits } = await listCatalogue(raw, {}, NOW);
    expect(agences.map((x) => x.slug)).toEqual(["green-trek-mada", "tanety-trek"]);
    expect(circuits.map((c) => c.slug)).toEqual(["lacs", "sentier"]);
    expect(circuits[0]).toMatchObject({
      agence: { slug: "tanety-trek", nom: "Tanety Trek" },
      prixMin: 100_000,
      prochainDepart: { dateDebut: "2026-11-25", placesLibres: 8 },
    });
  });

  it("une agence suspendue disparaît du catalogue (RG 19)", async () => {
    await circuit(agenceB.id, "lacs", "Lacs et volcans");
    await raw.agence.update({ where: { id: agenceB.id }, data: { statut: "SUSPENDUE" } });
    const { agences, circuits } = await listCatalogue(raw, {}, NOW);
    expect(agences.map((x) => x.slug)).toEqual(["green-trek-mada"]);
    expect(circuits).toHaveLength(0);
  });

  it("filtres : texte libre (titre, agence, ville), difficulté, nombre de voyageurs", async () => {
    const a = await circuit(agenceA.id, "sentier", "Sentier côtier");
    const b = await circuit(agenceB.id, "lacs", "Lacs et volcans", "PUBLIE", "MOYENNE");
    await depart(agenceA.id, a.id, "2026-12-20", 2);
    await depart(agenceB.id, b.id, "2026-11-25", 8);
    const slugs = async (q: Parameters<typeof listCatalogue>[1]) =>
      (await listCatalogue(raw, q, NOW)).circuits.map((c) => c.slug);
    expect(await slugs({ q: "antsirabe" })).toEqual(["lacs"]);
    expect(await slugs({ q: "CÔTIER" })).toEqual(["sentier"]);
    expect(await slugs({ difficulte: "MOYENNE" })).toEqual(["lacs"]);
    expect(await slugs({ voyageurs: 4 })).toEqual(["lacs"]);
  });

  it("fiche : circuit publié seulement, sans le prix interne des prestations", async () => {
    const a = await circuit(agenceA.id, "sentier", "Sentier côtier");
    await circuit(agenceA.id, "brouillon", "En préparation", "BROUILLON");
    await depart(agenceA.id, a.id, "2026-12-20");
    const partenaire = await raw.partenaire.create({
      data: { agenceId: agenceA.id, nom: "Vanilla Café", type: "RESTAURATION" },
    });
    await raw.circuitPartenaire.create({
      data: {
        circuitId: a.id,
        partenaireId: partenaire.id,
        prestation: "Déjeuner",
        prixUnitaire: 15_000,
      },
    });

    const fiche = await getCatalogueCircuit(raw, agenceA.slug, "sentier", NOW);
    expect(fiche).toMatchObject({
      titre: "Sentier côtier",
      departs: [{ dateDebut: "2026-12-20" }],
      partenaires: [{ prestation: "Déjeuner", partenaire: "Vanilla Café" }],
    });
    expect(JSON.stringify(fiche)).not.toContain("15000");
    expect(await getCatalogueCircuit(raw, agenceA.slug, "brouillon", NOW)).toBeNull();
    // Le circuit d'une agence n'est pas accessible par l'adresse d'une autre agence.
    expect(await getCatalogueCircuit(raw, agenceB.slug, "sentier", NOW)).toBeNull();
  });
});

describe("connexion et jeton", () => {
  it("un voyageur se connecte avec son compte de l'agence choisie, puis le jeton est accepté", async () => {
    const client = await user("voyageur@example.com", "CLIENT", agenceA.id);
    const session = await mobileLogin(
      { email: "voyageur@example.com", password: PASSWORD, agenceSlug: agenceA.slug },
      raw,
      NOW,
    );
    expect(session?.user).toMatchObject({ id: client.id, agenceSlug: agenceA.slug });
    const ctx = await mobileClientFromRequest(request(session!.token), raw, NOW);
    expect(ctx?.user.id).toBe(client.id);
    // Le client confiné est celui de SON agence.
    expect((await ctx!.db.agence.findFirstOrThrow()).id).toBe(agenceA.id);
  });

  it("refuse : mauvaise agence, mauvais mot de passe, compte du personnel", async () => {
    await user("voyageur@example.com", "CLIENT", agenceA.id);
    await user("staff@example.com", "STAFF", agenceA.id);
    const login = (email: string, password: string, agenceSlug: string) =>
      mobileLogin({ email, password, agenceSlug }, raw, NOW);
    expect(await login("voyageur@example.com", PASSWORD, agenceB.slug)).toBeNull();
    expect(await login("voyageur@example.com", "Mauvais2026", agenceA.slug)).toBeNull();
    expect(await login("staff@example.com", PASSWORD, agenceA.slug)).toBeNull();
  });

  it("le jeton est revérifié à chaque requête : compte désactivé ou agence suspendue → refus", async () => {
    const client = await user("voyageur@example.com", "CLIENT", agenceA.id);
    const session = await mobileLogin(
      { email: "voyageur@example.com", password: PASSWORD, agenceSlug: agenceA.slug },
      raw,
      NOW,
    );
    expect(await mobileClientFromRequest(request(), raw, NOW)).toBeNull();
    expect(await mobileClientFromRequest(request("faux.jeton.x"), raw, NOW)).toBeNull();

    await raw.agence.update({ where: { id: agenceA.id }, data: { statut: "SUSPENDUE" } });
    expect(await mobileClientFromRequest(request(session!.token), raw, NOW)).toBeNull();
    await raw.agence.update({ where: { id: agenceA.id }, data: { statut: "ACTIVE" } });
    await raw.utilisateur.update({ where: { id: client.id }, data: { actif: false } });
    expect(await mobileClientFromRequest(request(session!.token), raw, NOW)).toBeNull();
  });
});
