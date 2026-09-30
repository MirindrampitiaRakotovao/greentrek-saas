import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { Role } from "@/generated/prisma/client";
import { parseIsoDate } from "@/lib/departs";
import {
  countUnreadConversations,
  getConversation,
  listConversations,
  markConversationRead,
  sendMessage,
  startConversation,
  type Viewer,
} from "@/lib/services/messagerie";
import { getTenantDb, type TenantDb, TenantViolationError } from "@/lib/tenant";

import { createTestClient, truncateAll } from "./test-db";

/** Messagerie (après E12) : portée de chaque rôle, non-lus, isolation, simultanéité. */
const raw = createTestClient();
const T0 = new Date("2026-09-29T09:00:00.000Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

afterAll(async () => {
  await raw.$disconnect();
});

let agenceA: { id: string };
let agenceB: { id: string };
let dbA: TenantDb;
let dbB: TenantDb;
let admin: Viewer;
let staff: Viewer;
let guide1: Viewer;
let guide2: Viewer;
let client1: Viewer;
let client2: Viewer;
let resa1: string; // client1, départ encadré par guide1
let resa2: string; // client2, départ encadré par guide2

async function user(email: string, prenom: string, role: Role): Promise<Viewer> {
  const u = await raw.utilisateur.create({
    data: { agenceId: agenceA.id, prenom, nom: "Test", email, motDePasseHash: "x", role },
  });
  return { id: u.id, role };
}

async function sessionWithGuide(guideUser: Viewer, circuitId: string, debut: string) {
  const guide = await raw.guide.create({
    data: {
      agenceId: agenceA.id,
      utilisateurId: guideUser.id,
      prenom: "G",
      nom: "Guide",
      langues: ["fr"],
    },
  });
  const dateDebut = parseIsoDate(debut);
  return raw.sessionDepart.create({
    data: {
      agenceId: agenceA.id,
      circuitId,
      guideId: guide.id,
      dateDebut,
      dateFin: dateDebut,
      placesTotal: 8,
    },
  });
}

async function reservation(reference: string, clientId: string, sessionId: string) {
  return (
    await raw.reservation.create({
      data: {
        agenceId: agenceA.id,
        reference,
        clientId,
        sessionId,
        nombrePersonnes: 1,
        montantTotal: 100_000,
      },
    })
  ).id;
}

function start(viewer: Viewer, reservationId: string | null, contenu: string, minute = 0) {
  return startConversation(
    dbA,
    viewer,
    { agenceId: agenceA.id, reservationId, sujet: null, contenu },
    at(minute),
  );
}

function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

beforeEach(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({ data: { nom: "Green Trek Mada", slug: "green-trek-mada" } });
  agenceB = await raw.agence.create({ data: { nom: "Agence B", slug: "agence-b" } });
  dbA = getTenantDb(agenceA.id, raw);
  dbB = getTenantDb(agenceB.id, raw);
  admin = await user("admin@a.test", "Hanta", "ADMIN_AGENCE");
  staff = await user("staff@a.test", "Mamy", "STAFF");
  guide1 = await user("g1@a.test", "Tahina", "GUIDE");
  guide2 = await user("g2@a.test", "Faly", "GUIDE");
  client1 = await user("c1@a.test", "Hery", "CLIENT");
  client2 = await user("c2@a.test", "Voahangy", "CLIENT");
  const circuit = await raw.circuit.create({
    data: {
      agenceId: agenceA.id,
      titre: "Sentier côtier",
      slug: "sentier",
      difficulte: "FACILE",
      dureeJours: 1,
      prixParPersonne: 100_000,
      capaciteMax: 10,
    },
  });
  const s1 = await sessionWithGuide(guide1, circuit.id, "2026-10-10");
  const s2 = await sessionWithGuide(guide2, circuit.id, "2026-10-20");
  resa1 = await reservation("GTM-2026-0001", client1.id, s1.id);
  resa2 = await reservation("GTM-2026-0002", client2.id, s2.id);
});

describe("ouverture d'une conversation", () => {
  it("le client écrit au sujet de sa réservation ; un second message rejoint la même conversation", async () => {
    const first = unwrap(await start(client1, resa1, "Faut-il des chaussures de marche ?"));
    const conversation = await raw.conversation.findUniqueOrThrow({
      where: { id: first.conversationId },
    });
    expect(conversation).toMatchObject({
      clientId: client1.id,
      reservationId: resa1,
      sujet: "Sentier côtier · GTM-2026-0001",
    });
    const second = unwrap(await start(client1, resa1, "Et un chapeau ?", 5));
    expect(second.conversationId).toBe(first.conversationId);
    expect(await raw.conversation.count()).toBe(1);
    expect(await raw.message.count()).toBe(2);
  });

  it("refuse la réservation d'un autre client", async () => {
    expect((await start(client1, resa2, "Bonjour")).ok).toBe(false);
    expect(await raw.conversation.count()).toBe(0);
  });

  it("question générale : possible pour un client, pas pour l'agence (voyageur non désigné)", async () => {
    const q = unwrap(await start(client1, null, "Proposez-vous des circuits en famille ?"));
    expect(
      (await raw.conversation.findUniqueOrThrow({ where: { id: q.conversationId } })).sujet,
    ).toBe("Question à l'agence");
    expect((await start(staff, null, "Bonjour")).ok).toBe(false);
  });

  it("l'agence et le guide du départ peuvent écrire au voyageur d'une réservation", async () => {
    const parAgence = unwrap(await start(staff, resa1, "Votre départ est confirmé."));
    const conversation = await raw.conversation.findUniqueOrThrow({
      where: { id: parAgence.conversationId },
    });
    expect(conversation.clientId).toBe(client1.id);
    expect((await start(guide1, resa1, "Rendez-vous à 7 h au port.", 5)).ok).toBe(true);
    // Le guide d'un autre départ ne le peut pas.
    expect((await start(guide2, resa1, "Bonjour")).ok).toBe(false);
  });

  it("deux premiers messages simultanés sur une réservation : une seule conversation", async () => {
    const results = await Promise.all([
      start(client1, resa1, "Premier"),
      start(staff, resa1, "Second"),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await raw.conversation.count()).toBe(1);
    expect(await raw.message.count()).toBe(2);
  });
});

describe("portée de chaque rôle", () => {
  let conv1: string;
  let conv2: string;
  beforeEach(async () => {
    conv1 = unwrap(await start(client1, resa1, "Question 1")).conversationId;
    conv2 = unwrap(await start(client2, resa2, "Question 2")).conversationId;
  });

  it("administrateur et personnel voient toutes les conversations de l'agence", async () => {
    for (const viewer of [admin, staff]) {
      expect((await listConversations(dbA, viewer, 1)).total).toBe(2);
    }
  });

  it("le client ne voit que les siennes", async () => {
    const list = await listConversations(dbA, client1, 1);
    expect(list.items.map((c) => c.id)).toEqual([conv1]);
    expect(await getConversation(dbA, client1, conv2)).toBeNull();
    expect(
      (await sendMessage(dbA, client1, { conversationId: conv2, contenu: "Intrusion" })).ok,
    ).toBe(false);
  });

  it("le guide ne voit que les conversations de ses départs et peut y répondre", async () => {
    expect((await listConversations(dbA, guide1, 1)).items.map((c) => c.id)).toEqual([conv1]);
    expect((await sendMessage(dbA, guide1, { conversationId: conv1, contenu: "Oui" })).ok).toBe(
      true,
    );
    expect((await sendMessage(dbA, guide1, { conversationId: conv2, contenu: "Non" })).ok).toBe(
      false,
    );
    expect(await getConversation(dbA, guide1, conv2)).toBeNull();
  });

  it("le fil affiche les messages dans l'ordre, avec leur auteur", async () => {
    await sendMessage(dbA, staff, { conversationId: conv1, contenu: "Réponse" }, at(10));
    const thread = await getConversation(dbA, client1, conv1);
    expect(thread?.messages.map((m) => [m.contenu, m.auteur.role])).toEqual([
      ["Question 1", "CLIENT"],
      ["Réponse", "STAFF"],
    ]);
  });
});

describe("messages non lus", () => {
  it("boîte partagée : la réponse d'un collègue n'est pas signalée comme non lue", async () => {
    const { conversationId } = unwrap(await start(client1, resa1, "Bonjour", 0));
    expect(await countUnreadConversations(dbA, staff)).toBe(1);
    expect(await countUnreadConversations(dbA, admin)).toBe(1);
    expect(await countUnreadConversations(dbA, client1)).toBe(0); // son propre message

    await sendMessage(dbA, staff, { conversationId, contenu: "Bonjour, oui ?" }, at(5));
    expect(await countUnreadConversations(dbA, admin)).toBe(0);
    expect(await countUnreadConversations(dbA, client1)).toBe(1);
    expect((await listConversations(dbA, client1, 1)).items[0]).toMatchObject({
      nonLue: true,
      dernierMessage: { contenu: "Bonjour, oui ?", auteurPrenom: "Mamy" },
    });

    unwrap(await markConversationRead(dbA, client1, conversationId, at(6)));
    expect(await countUnreadConversations(dbA, client1)).toBe(0);
  });

  it("le guide voit comme non lu un message du voyageur ou de l'agence", async () => {
    const { conversationId } = unwrap(await start(client1, resa1, "Bonjour", 0));
    expect(await countUnreadConversations(dbA, guide1)).toBe(1);
    expect(await countUnreadConversations(dbA, guide2)).toBe(0);
    unwrap(await markConversationRead(dbA, guide1, conversationId, at(1)));
    await sendMessage(dbA, staff, { conversationId, contenu: "Info" }, at(2));
    expect(await countUnreadConversations(dbA, guide1)).toBe(1);
  });

  it("impossible de marquer comme lue une conversation hors de sa portée", async () => {
    const { conversationId } = unwrap(await start(client1, resa1, "Bonjour"));
    expect((await markConversationRead(dbA, client2, conversationId)).ok).toBe(false);
    expect(await raw.lectureConversation.count({ where: { utilisateurId: client2.id } })).toBe(0);
  });
});

describe("isolation entre agences", () => {
  it("l'agence B ne lit, n'écrit ni ne crée rien dans les conversations de A", async () => {
    const { conversationId } = unwrap(await start(client1, resa1, "Bonjour"));
    const staffB: Viewer = { id: staff.id, role: "STAFF" };
    expect((await listConversations(dbB, staffB, 1)).total).toBe(0);
    expect(await getConversation(dbB, staffB, conversationId)).toBeNull();
    expect((await sendMessage(dbB, staffB, { conversationId, contenu: "x" })).ok).toBe(false);
    await expect(
      dbB.message.create({ data: { conversationId, auteurId: staff.id, contenu: "x" } }),
    ).rejects.toBeInstanceOf(TenantViolationError);
    await expect(
      dbB.conversation.create({
        data: { agenceId: agenceB.id, clientId: client1.id, sujet: "x" },
      }),
    ).rejects.toBeInstanceOf(TenantViolationError);
    expect(await dbB.message.count()).toBe(0);
    expect(await raw.message.count()).toBe(1);
  });
});

describe("contraintes CHECK", () => {
  it("refuse un message ou un sujet vide en base", async () => {
    const { conversationId } = unwrap(await start(client1, resa1, "Bonjour"));
    await expect(
      raw.message.create({ data: { conversationId, auteurId: client1.id, contenu: "   " } }),
    ).rejects.toThrow();
    await expect(
      raw.conversation.create({ data: { agenceId: agenceA.id, clientId: client1.id, sujet: "" } }),
    ).rejects.toThrow();
  });
});
