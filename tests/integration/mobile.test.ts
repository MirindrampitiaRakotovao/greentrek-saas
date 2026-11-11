import bcrypt from "bcryptjs";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Role } from "@/generated/prisma/client";
import { parseIsoDate } from "@/lib/departs";
import { mobileActivity, mobileNotifications, toMobileThread } from "@/lib/mobile/activite";
import { toMobileReservation } from "@/lib/mobile/reservations";
import { mobileClientFromRequest, mobileLogin, mobileProfile } from "@/lib/mobile/session";
import {
  pushSettled,
  registerDevice,
  setPushTransport,
  unregisterDevice,
} from "@/lib/services/appareils";
import { createAvis } from "@/lib/services/avis";
import { confirmReservation } from "@/lib/services/gestion-reservations";
import { getConversation, sendMessage, startConversation } from "@/lib/services/messagerie";
import { getCatalogueCircuit, listCatalogue } from "@/lib/services/catalogue";
import {
  cancelReservationByClient,
  createReservation,
  getClientReservation,
  listClientReservations,
  payReservation,
} from "@/lib/services/reservations";
import { updateProfile } from "@/lib/services/team";

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

describe("réservation depuis l'application (lot A3)", () => {
  /** Voyageur connecté par jeton, comme dans les routes : client confiné à SON agence. */
  async function connect(email: string, agenceId: string, agenceSlug: string) {
    await user(email, "CLIENT", agenceId);
    const session = await mobileLogin({ email, password: PASSWORD, agenceSlug }, raw, NOW);
    return (await mobileClientFromRequest(request(session!.token), raw, NOW))!;
  }
  const participants = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      prenom: `Voyageur${i}`,
      nom: "Test",
      age: null,
      nationalite: null,
      contactUrgence: null,
    }));

  it("réserve dans son agence, paie par carte : réservation confirmée, visible dans la liste", async () => {
    const c = await circuit(agenceA.id, "sentier", "Sentier côtier");
    const d = await depart(agenceA.id, c.id, "2026-12-20", 8);
    const ctx = await connect("voyageur@example.com", agenceA.id, agenceA.slug);
    const base = {
      agenceId: ctx.user.agenceId,
      agenceSlug: ctx.user.agenceSlug,
      clientId: ctx.user.id,
    };

    const created = await createReservation(
      ctx.db,
      { ...base, sessionId: d.id, participants: participants(2), remarques: null },
      NOW,
    );
    expect(created.ok).toBe(true);
    const id = created.ok ? created.data.id : "";

    const refus = await payReservation(
      ctx.db,
      {
        reservationId: id,
        methode: "CARTE_SIMULEE",
        numero: "4000000000000000",
        clientId: ctx.user.id,
      },
      NOW,
    );
    expect(refus.ok && refus.data.statut).toBe("ECHOUE");
    const paye = await payReservation(
      ctx.db,
      {
        reservationId: id,
        methode: "CARTE_SIMULEE",
        numero: "4242424242424242",
        clientId: ctx.user.id,
      },
      NOW,
    );
    expect(paye.ok && paye.data.confirmee).toBe(true);

    const [r] = await listClientReservations(ctx.db, ctx.user.id, NOW);
    const json = toMobileReservation(r!, {
      slug: "green-trek-mada",
      nom: "Green Trek Mada",
      devise: "MGA",
    });
    expect(json).toMatchObject({
      statut: "CONFIRMEE",
      statutLabel: "Confirmée",
      montantTotal: 200_000,
      reste: 0,
      peutPayer: false,
      peutAnnuler: true,
      depart: { dateDebut: "2026-12-20" },
      participants: [{ prenom: "Voyageur0" }, { prenom: "Voyageur1" }],
    });
    expect(json.paiements.map((p) => p.statutLabel)).toEqual(["Échoué", "Validé"]);
    // Seuls les 4 derniers chiffres du numéro sont conservés.
    expect(JSON.stringify(json)).not.toContain("4242424242424242");

    expect(
      (await cancelReservationByClient(ctx.db, { reservationId: id, clientId: ctx.user.id }, NOW))
        .ok,
    ).toBe(true);
  });

  it("refuse le départ d'une autre agence et cache la réservation d'un autre voyageur", async () => {
    const cB = await circuit(agenceB.id, "lacs", "Lacs et volcans");
    const dB = await depart(agenceB.id, cB.id, "2026-12-20");
    const cA = await circuit(agenceA.id, "sentier", "Sentier côtier");
    const dA = await depart(agenceA.id, cA.id, "2026-12-20");
    const voyageur = await connect("voyageur@example.com", agenceA.id, agenceA.slug);
    const autre = await connect("autre@example.com", agenceA.id, agenceA.slug);
    const base = {
      agenceId: voyageur.user.agenceId,
      agenceSlug: voyageur.user.agenceSlug,
      clientId: voyageur.user.id,
    };

    const ailleurs = await createReservation(
      voyageur.db,
      { ...base, sessionId: dB.id, participants: participants(1), remarques: null },
      NOW,
    );
    expect(ailleurs).toEqual({ ok: false, error: "Départ introuvable." });

    const ici = await createReservation(
      voyageur.db,
      { ...base, sessionId: dA.id, participants: participants(1), remarques: null },
      NOW,
    );
    const id = ici.ok ? ici.data.id : "";
    expect(await getClientReservation(autre.db, id, autre.user.id, NOW)).toBeNull();
    expect(await listClientReservations(autre.db, autre.user.id, NOW)).toHaveLength(0);
    expect(
      (
        await payReservation(
          autre.db,
          { reservationId: id, methode: "ESPECES", clientId: autre.user.id },
          NOW,
        )
      ).ok,
    ).toBe(false);
  });
});

describe("compte et avis depuis l'application (lot A4b)", () => {
  async function connect(email: string) {
    await user(email, "CLIENT", agenceA.id);
    const session = await mobileLogin(
      { email, password: PASSWORD, agenceSlug: agenceA.slug },
      raw,
      NOW,
    );
    return (await mobileClientFromRequest(request(session!.token), raw, NOW))!;
  }

  it("modifie son profil (prénom, nom, téléphone) par le service du site", async () => {
    const ctx = await connect("voyageur@example.com");
    const res = await updateProfile(ctx.db, ctx.user.id, {
      prenom: "Lova",
      nom: "Rabe",
      telephone: null,
    });
    expect(res.ok).toBe(true);
    expect(await mobileProfile(ctx.user.id, raw)).toMatchObject({ prenom: "Lova", nom: "Rabe" });
  });

  it("avis sur un séjour terminé : proposé une fois, puis affiché en attente de relecture", async () => {
    const c = await circuit(agenceA.id, "sentier", "Sentier côtier");
    const d = await depart(agenceA.id, c.id, "2026-10-01");
    const ctx = await connect("voyageur@example.com");
    const r = await raw.reservation.create({
      data: {
        agenceId: agenceA.id,
        reference: "GT-TEST-0001",
        clientId: ctx.user.id,
        sessionId: d.id,
        nombrePersonnes: 1,
        montantTotal: 100_000,
        statut: "TERMINEE",
      },
    });
    const agence = { slug: agenceA.slug, nom: "Green Trek Mada", devise: "MGA" };

    const [avant] = await listClientReservations(ctx.db, ctx.user.id, NOW);
    expect(toMobileReservation(avant!, agence)).toMatchObject({ peutDonnerAvis: true, avis: null });

    const input = {
      agenceId: agenceA.id,
      reservationId: r.id,
      clientId: ctx.user.id,
      note: 5,
      commentaire: "Très belle marche.",
    };
    expect((await createAvis(ctx.db, input, NOW)).ok).toBe(true);
    expect((await createAvis(ctx.db, input, NOW)).ok).toBe(false);

    const [apres] = await listClientReservations(ctx.db, ctx.user.id, NOW);
    expect(toMobileReservation(apres!, agence)).toMatchObject({
      peutDonnerAvis: false,
      avis: { note: 5, statut: "EN_ATTENTE" },
    });
  });
});

describe("messagerie et notifications de l'application (lot A4c)", () => {
  const TOKEN = "ExponentPushToken[telephone-du-voyageur]";
  let sent: { to: string; title: string; body: string; data: unknown }[] = [];
  let refuse = new Set<string>();

  beforeEach(() => {
    sent = [];
    refuse = new Set();
    setPushTransport(async (_url, init) => {
      const batch = JSON.parse(String(init.body)) as typeof sent;
      sent.push(...batch);
      return Response.json({
        data: batch.map((m) =>
          refuse.has(m.to)
            ? { status: "error", details: { error: "DeviceNotRegistered" } }
            : { status: "ok" },
        ),
      });
    }, raw);
  });
  afterEach(() => setPushTransport(undefined));

  async function connect(email: string, agence = agenceA) {
    await user(email, "CLIENT", agence.id);
    const session = await mobileLogin(
      { email, password: PASSWORD, agenceSlug: agence.slug },
      raw,
      NOW,
    );
    return (await mobileClientFromRequest(request(session!.token), raw, NOW))!;
  }

  async function reservationOf(ctx: Awaited<ReturnType<typeof connect>>) {
    const c = await circuit(ctx.user.agenceId, "sentier", "Sentier côtier");
    const d = await depart(ctx.user.agenceId, c.id, "2026-12-20");
    return raw.reservation.create({
      data: {
        agenceId: ctx.user.agenceId,
        reference: "GTM-2026-0001",
        clientId: ctx.user.id,
        sessionId: d.id,
        nombrePersonnes: 1,
        montantTotal: 100_000,
      },
    });
  }

  it("confirmation par l'agence : notification enregistrée et téléphone prévenu après le commit", async () => {
    const ctx = await connect("voyageur@example.com");
    const r = await reservationOf(ctx);
    await registerDevice(ctx.db, {
      agenceId: ctx.user.agenceId,
      utilisateurId: ctx.user.id,
      expoPushToken: TOKEN,
      plateforme: "android",
    });
    // Personnel actif : notifié dans le site, mais il n'a pas l'application (aucun envoi).
    await user("admin@example.com", "ADMIN_AGENCE", agenceA.id);

    const before = new Date();
    const res = await confirmReservation(ctx.db, r.id, NOW);
    expect(res.ok).toBe(true);
    await pushSettled();

    expect(sent).toEqual([
      expect.objectContaining({
        to: TOKEN,
        title: "Réservation GTM-2026-0001 confirmée",
        sound: "default",
        data: { type: "reservation", reservationId: r.id },
      }),
    ]);
    expect(JSON.stringify(sent)).not.toMatch(/100\s?000/);

    const list = await mobileNotifications(ctx.db, ctx.user.id);
    expect(list.nonLues).toBe(1);
    expect(list.notifications[0]).toMatchObject({ reservationId: r.id, lue: false });

    const activity = await mobileActivity(
      ctx.db,
      { id: ctx.user.id, role: "CLIENT" },
      new Date(before.getTime() - 60_000),
      new Date(Date.now() + 60_000),
    );
    expect(activity.notifications).toHaveLength(1);
    expect(activity.nonLues.notifications).toBe(1);
  });

  it("message de l'agence : téléphone prévenu (sans le texte), visible dans le fil et les nouveautés", async () => {
    const ctx = await connect("voyageur@example.com");
    const r = await reservationOf(ctx);
    await registerDevice(ctx.db, {
      agenceId: ctx.user.agenceId,
      utilisateurId: ctx.user.id,
      expoPushToken: TOKEN,
      plateforme: "ios",
    });
    const voyageur = { id: ctx.user.id, role: "CLIENT" as const };
    const started = await startConversation(
      ctx.db,
      voyageur,
      {
        agenceId: agenceA.id,
        reservationId: r.id,
        sujet: null,
        contenu: "Faut-il des chaussures de marche ?",
      },
      NOW,
    );
    expect(started.ok).toBe(true);
    const conversationId = started.ok ? started.data.conversationId : "";
    await pushSettled();
    expect(sent).toHaveLength(0); // son propre message ne fait pas sonner son téléphone

    const admin = await user("admin@example.com", "ADMIN_AGENCE", agenceA.id);
    const later = new Date(NOW.getTime() + 60_000);
    await sendMessage(
      ctx.db,
      { id: admin.id, role: "ADMIN_AGENCE" },
      { conversationId, contenu: "Oui, et le code du portail est 4521." },
      later,
    );
    await pushSettled();
    expect(sent).toEqual([
      expect.objectContaining({
        to: TOKEN,
        title: "Nouveau message de Hery T.",
        body: "Sentier côtier · GTM-2026-0001",
        data: { type: "message", conversationId },
      }),
    ]);
    expect(JSON.stringify(sent)).not.toContain("4521");

    const activity = await mobileActivity(ctx.db, voyageur, NOW, later);
    expect(activity.messages).toEqual([
      expect.objectContaining({ conversationId, auteur: "Hery T." }),
    ]);
    expect(activity.nonLues.conversations).toBe(1);

    const thread = toMobileThread(
      (await getConversation(ctx.db, voyageur, conversationId))!,
      ctx.user.id,
    );
    expect(thread.messages.map((m) => [m.deMoi, m.cote])).toEqual([
      [true, "Voyageur"],
      [false, "Agence"],
    ]);
  });

  it("téléphone désinstallé : jeton oublié ; déconnexion : jeton retiré", async () => {
    const ctx = await connect("voyageur@example.com");
    const r = await reservationOf(ctx);
    const device = {
      agenceId: ctx.user.agenceId,
      utilisateurId: ctx.user.id,
      expoPushToken: TOKEN,
      plateforme: "android",
    };
    await registerDevice(ctx.db, device);
    refuse.add(TOKEN);
    await confirmReservation(ctx.db, r.id, NOW);
    await pushSettled();
    expect(sent).toHaveLength(1);
    expect(await raw.appareilMobile.count()).toBe(0);

    await registerDevice(ctx.db, device);
    expect((await unregisterDevice(ctx.db, ctx.user.id, TOKEN)).ok).toBe(true);
    expect(await raw.appareilMobile.count()).toBe(0);
  });

  it("même téléphone : le dernier compte connecté de l'agence le reçoit ; agences isolées", async () => {
    const a = await connect("voyageur@example.com");
    const b = await connect("autre@example.com");
    const c = await connect("voyageur@example.com", agenceB);
    for (const ctx of [a, b, c]) {
      await registerDevice(ctx.db, {
        agenceId: ctx.user.agenceId,
        utilisateurId: ctx.user.id,
        expoPushToken: TOKEN,
        plateforme: "android",
      });
    }
    const rows = await raw.appareilMobile.findMany({ select: { utilisateurId: true } });
    expect(rows.map((r) => r.utilisateurId).sort()).toEqual([b.user.id, c.user.id].sort());
    // Un voyageur de l'agence A ne voit pas le téléphone enregistré dans l'agence B.
    expect(await a.db.appareilMobile.count()).toBe(1);
    expect((await unregisterDevice(a.db, c.user.id, TOKEN)).ok).toBe(false);
  });
});
