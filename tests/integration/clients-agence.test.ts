import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { authenticate } from "@/lib/auth/authenticate";
import { parseIsoDate } from "@/lib/departs";
import {
  CLIENT_EMAIL_TAKEN,
  createClientByAgency,
  listBookableDeparts,
  listClients,
} from "@/lib/services/clients";
import { checkResetToken, resetPassword } from "@/lib/services/mot-de-passe";
import { createReservation } from "@/lib/services/reservations";
import { getTenantDb, type TenantDb } from "@/lib/tenant";

import { createTestClient, truncateAll } from "./test-db";

/**
 * Clients ajoutés par l'agence (après E12) : compte créé par l'agence, invitation par e-mail
 * (lien 7 jours), réservation faite par l'agence avec les mêmes règles que le site.
 */
const raw = createTestClient();
const NOW = new Date("2026-11-19T09:00:00.000Z");
const DAY = 24 * 3_600_000;

afterAll(async () => {
  await raw.$disconnect();
});

let agenceA: { id: string; slug: string };
let agenceB: { id: string; slug: string };
let dbA: TenantDb;
let dbB: TenantDb;

beforeEach(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({
    data: { nom: "Green Trek Mada", slug: "green-trek-mada" },
  });
  agenceB = await raw.agence.create({ data: { nom: "Tanety Trek", slug: "tanety-trek" } });
  dbA = getTenantDb(agenceA.id, raw);
  dbB = getTenantDb(agenceB.id, raw);
});

const client = (email = "voyageur@example.com") => ({
  prenom: "Lova",
  nom: "Rabe",
  email,
  telephone: null,
});

async function depart(places = 4, debut = "2026-12-20", statut: "PUBLIE" | "BROUILLON" = "PUBLIE") {
  const c = await raw.circuit.create({
    data: {
      agenceId: agenceA.id,
      titre: "Sentier côtier",
      slug: `sentier-${Math.random().toString(36).slice(2, 8)}`,
      difficulte: "FACILE",
      dureeJours: 1,
      prixParPersonne: 100_000,
      capaciteMax: 10,
      statut,
    },
  });
  const dateDebut = parseIsoDate(debut);
  return raw.sessionDepart.create({
    data: {
      agenceId: agenceA.id,
      circuitId: c.id,
      dateDebut,
      dateFin: dateDebut,
      placesTotal: places,
    },
  });
}

const participants = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    prenom: `Voyageur${i}`,
    nom: "Test",
    age: null,
    nationalite: null,
    contactUrgence: null,
  }));

describe("client ajouté par l'agence", () => {
  it("compte voyageur « ajouté par l'agence », inutilisable avant l'invitation", async () => {
    const res = await createClientByAgency(dbA, agenceA.id, client(), NOW);
    expect(res.ok).toBe(true);
    const u = await raw.utilisateur.findUniqueOrThrow({
      where: { id: res.ok ? res.data.id : "" },
    });
    expect(u).toMatchObject({ role: "CLIENT", origine: "AGENCE", agenceId: agenceA.id });
    // Aucun mot de passe connu : la connexion échoue tant que le client n'a pas choisi le sien.
    expect(
      await authenticate(
        { email: "voyageur@example.com", password: "Voyage2026", agenceSlug: agenceA.slug },
        raw,
      ),
    ).toBeNull();
    // Seule l'empreinte du jeton est en base.
    const jeton = res.ok ? res.data.jeton : "";
    expect(await raw.jetonReinitialisation.count({ where: { empreinte: jeton } })).toBe(0);
  });

  it("invitation valable 7 jours : le client choisit son mot de passe puis se connecte", async () => {
    const res = await createClientByAgency(dbA, agenceA.id, client(), NOW);
    const jeton = res.ok ? res.data.jeton : "";
    const later = new Date(NOW.getTime() + 6 * DAY);
    expect(await checkResetToken(raw, jeton, agenceA.slug, later)).toEqual({ prenom: "Lova" });
    // Le lien ne s'ouvre que sur le site de SON agence.
    expect(await checkResetToken(raw, jeton, agenceB.slug, later)).toBeNull();
    expect(
      (await resetPassword(raw, { jeton, password: "Voyage2026", agenceSlug: agenceA.slug }, later))
        .ok,
    ).toBe(true);
    expect(
      await authenticate(
        { email: "voyageur@example.com", password: "Voyage2026", agenceSlug: agenceA.slug },
        raw,
      ),
    ).not.toBeNull();
  });

  it("invitation expirée après 7 jours", async () => {
    const res = await createClientByAgency(dbA, agenceA.id, client(), NOW);
    const jeton = res.ok ? res.data.jeton : "";
    const tooLate = new Date(NOW.getTime() + 7 * DAY + 1000);
    expect(await checkResetToken(raw, jeton, agenceA.slug, tooLate)).toBeNull();
  });

  it("e-mail unique dans l'agence (RG 3), possible dans une autre agence", async () => {
    await createClientByAgency(dbA, agenceA.id, client(), NOW);
    expect(await createClientByAgency(dbA, agenceA.id, client(), NOW)).toEqual({
      ok: false,
      error: CLIENT_EMAIL_TAKEN,
      field: "email",
    });
    expect((await createClientByAgency(dbB, agenceB.id, client(), NOW)).ok).toBe(true);
  });

  it("liste des clients : origine affichée et filtre, sans les clients d'une autre agence", async () => {
    await createClientByAgency(dbA, agenceA.id, client("ajoute@example.com"), NOW);
    await raw.utilisateur.create({
      data: {
        agenceId: agenceA.id,
        prenom: "Hery",
        nom: "Inscrit",
        email: "inscrit@example.com",
        motDePasseHash: "x",
        role: "CLIENT",
      },
    });
    await createClientByAgency(dbB, agenceB.id, client("autre@example.com"), NOW);

    const tous = await listClients(dbA, undefined, 1);
    expect(tous.items.map((c) => [c.email, c.origine]).sort()).toEqual([
      ["ajoute@example.com", "AGENCE"],
      ["inscrit@example.com", "INSCRIPTION"],
    ]);
    const ajoutes = await listClients(dbA, undefined, 1, "AGENCE");
    expect(ajoutes.items.map((c) => c.email)).toEqual(["ajoute@example.com"]);
  });
});

describe("réservation faite par l'agence pour un client", () => {
  async function newClient() {
    const res = await createClientByAgency(dbA, agenceA.id, client(), NOW);
    return res.ok ? res.data.id : "";
  }
  const base = (clientId: string, sessionId: string, n = 2) => ({
    agenceId: agenceA.id,
    agenceSlug: agenceA.slug,
    clientId,
    sessionId,
    participants: participants(n),
    remarques: null,
    parAgence: true,
  });

  it("mêmes règles que le site ; le client est prévenu, pas l'équipe", async () => {
    const clientId = await newClient();
    const admin = await raw.utilisateur.create({
      data: {
        agenceId: agenceA.id,
        prenom: "A",
        nom: "Admin",
        email: "admin@example.com",
        motDePasseHash: "x",
        role: "ADMIN_AGENCE",
      },
    });
    const d = await depart(4);
    const res = await createReservation(dbA, base(clientId, d.id), NOW);
    expect(res.ok).toBe(true);
    const r = await raw.reservation.findUniqueOrThrow({ where: { id: res.ok ? res.data.id : "" } });
    expect(r).toMatchObject({
      clientId,
      statut: "EN_ATTENTE",
      nombrePersonnes: 2,
      montantTotal: 200_000,
    });
    const notifs = await raw.notification.findMany({
      select: { utilisateurId: true, titre: true },
    });
    expect(notifs).toEqual([
      { utilisateurId: clientId, titre: `Réservation ${r.reference} créée par votre agence` },
    ]);
    expect(notifs.some((n) => n.utilisateurId === admin.id)).toBe(false);
  });

  it("jamais plus de places que le départ (RG 13)", async () => {
    const clientId = await newClient();
    const d = await depart(2);
    const res = await createReservation(dbA, base(clientId, d.id, 3), NOW);
    expect(res).toEqual({
      ok: false,
      error: "Il ne reste que 2 places sur ce départ.",
      field: "participants",
    });
  });

  it("refuse un titulaire qui n'est pas un voyageur de l'agence", async () => {
    const d = await depart(4);
    const staff = await raw.utilisateur.create({
      data: {
        agenceId: agenceA.id,
        prenom: "S",
        nom: "Staff",
        email: "staff@example.com",
        motDePasseHash: "x",
        role: "STAFF",
      },
    });
    const ailleurs = await createClientByAgency(dbB, agenceB.id, client("b@example.com"), NOW);
    expect(await createReservation(dbA, base(staff.id, d.id), NOW)).toEqual({
      ok: false,
      error: "Client introuvable.",
    });
    expect(
      await createReservation(dbA, base(ailleurs.ok ? ailleurs.data.id : "", d.id), NOW),
    ).toEqual({ ok: false, error: "Client introuvable." });
    expect(await raw.reservation.count()).toBe(0);
  });

  it("départs proposés : ouverts, circuit publié, à partir du lendemain, avec des places", async () => {
    const ok = await depart(4, "2026-12-20");
    await depart(4, "2026-11-19"); // trop proche (le jour même)
    await depart(4, "2026-12-21", "BROUILLON"); // circuit non publié
    const complet = await depart(1, "2026-12-22");
    const clientId = await newClient();
    await createReservation(dbA, base(clientId, complet.id, 1), NOW);
    expect((await listBookableDeparts(dbA, NOW)).map((d) => d.id)).toEqual([ok.id]);
    expect(await listBookableDeparts(dbB, NOW)).toEqual([]);
  });
});
