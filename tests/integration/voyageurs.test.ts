import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { subscribe } from "@/lib/realtime/bus";
import type { RealtimeEvent } from "@/lib/realtime/events";
import {
  countUnreadConversations,
  getConversation,
  listConversations,
  markConversationRead,
  sendMessage,
  startPrivateConversation,
  type Viewer,
} from "@/lib/services/messagerie";
import {
  blockUser,
  listSignalements,
  listVoyageurs,
  reportMessage,
  touchPresence,
  unblockUser,
  updatePrivacy,
} from "@/lib/services/voyageurs";
import { getTenantDb, type TenantDb } from "@/lib/tenant";

import { createTestClient, truncateAll } from "./test-db";

/**
 * Voyageurs entre eux (étape 5c) : conversations privées que l'agence ne lit pas, blocage,
 * réglages de confidentialité, signalement, présence, isolation des agences.
 */
const raw = createTestClient();
const T0 = new Date("2026-11-19T09:00:00.000Z");
const at = (min: number) => new Date(T0.getTime() + min * 60_000);

afterAll(async () => {
  await raw.$disconnect();
});

let agenceA: { id: string };
let agenceB: { id: string };
let dbA: TenantDb;
let dbB: TenantDb;
let lova: Viewer;
let hery: Viewer;
let fara: Viewer;
let staff: Viewer;
let ailleurs: Viewer;

async function user(agenceId: string, email: string, prenom: string, role: Viewer["role"]) {
  const u = await raw.utilisateur.create({
    data: { agenceId, email, prenom, nom: "Test", motDePasseHash: "x", role },
  });
  return { id: u.id, role };
}

beforeEach(async () => {
  await truncateAll(raw);
  agenceA = await raw.agence.create({ data: { nom: "A", slug: "a" } });
  agenceB = await raw.agence.create({ data: { nom: "B", slug: "b" } });
  dbA = getTenantDb(agenceA.id, raw);
  dbB = getTenantDb(agenceB.id, raw);
  lova = await user(agenceA.id, "lova@example.com", "Lova", "CLIENT");
  hery = await user(agenceA.id, "hery@example.com", "Hery", "CLIENT");
  fara = await user(agenceA.id, "fara@example.com", "Fara", "CLIENT");
  staff = await user(agenceA.id, "staff@example.com", "Staff", "STAFF");
  ailleurs = await user(agenceB.id, "b@example.com", "Bao", "CLIENT");
});

const start = (
  from: Viewer,
  to: Viewer,
  contenu = "Salut !",
  min = 0,
  db = dbA,
  agenceId = agenceA.id,
) => startPrivateConversation(db, from, { agenceId, destinataireId: to.id, contenu }, at(min));

describe("conversation privée entre voyageurs", () => {
  it("les deux voyageurs la voient ; l'agence, le guide et les autres non", async () => {
    const res = await start(lova, hery);
    expect(res.ok).toBe(true);
    const id = res.ok ? res.data.conversationId : "";
    expect(await getConversation(dbA, lova, id)).not.toBeNull();
    expect(await getConversation(dbA, hery, id)).not.toBeNull();
    expect(await getConversation(dbA, staff, id)).toBeNull();
    expect(await getConversation(dbA, fara, id)).toBeNull();
    expect((await listConversations(dbA, staff, 1)).total).toBe(0);
    // Une seconde ouverture reprend la même conversation (dans un sens comme dans l'autre).
    const again = await start(hery, lova, "Bonjour", 1);
    expect(again.ok && again.data.conversationId).toBe(id);
  });

  it("non lus, « Lu » et notification temps réel : entre les deux voyageurs seulement", async () => {
    const recus = new Map<string, RealtimeEvent[]>([
      [hery.id, []],
      [staff.id, []],
    ]);
    const offs = [hery, staff].map((u) => subscribe(u.id, (e) => recus.get(u.id)!.push(e)));
    const res = await start(lova, hery, "On randonne ensemble ?");
    const id = res.ok ? res.data.conversationId : "";
    offs.forEach((off) => off());
    expect(recus.get(hery.id)).toHaveLength(1);
    expect(recus.get(staff.id)).toHaveLength(0);

    expect(await countUnreadConversations(dbA, hery)).toBe(1);
    expect(await countUnreadConversations(dbA, lova)).toBe(0);
    expect((await getConversation(dbA, lova, id))!.messages[0]!.statut).toBe("DISTRIBUE");
    await markConversationRead(dbA, hery, id, at(2));
    expect(await countUnreadConversations(dbA, hery)).toBe(0);
    expect((await getConversation(dbA, lova, id))!.messages[0]!.statut).toBe("LU");
  });

  it("un voyageur d'une autre agence est introuvable", async () => {
    expect(await start(lova, ailleurs)).toEqual({ ok: false, error: "Voyageur introuvable." });
    expect(await start(lova, staff)).toEqual({ ok: false, error: "Voyageur introuvable." });
  });
});

describe("garde-fous", () => {
  it("blocage : plus aucun message dans les deux sens ; annuaire sans l'un ni l'autre", async () => {
    const res = await start(lova, hery);
    const id = res.ok ? res.data.conversationId : "";
    await blockUser(dbA, { agenceId: agenceA.id, bloqueurId: hery.id, bloqueId: lova.id });
    expect(await sendMessage(dbA, lova, { conversationId: id, contenu: "Encore moi" })).toEqual({
      ok: false,
      error: "Vous ne pouvez plus écrire à ce voyageur.",
    });
    expect((await sendMessage(dbA, hery, { conversationId: id, contenu: "Non" })).ok).toBe(false);
    expect((await listVoyageurs(dbA, lova.id, undefined, 1)).items.map((v) => v.nom)).toEqual([
      "Fara T.",
    ]);
    await unblockUser(dbA, hery.id, lova.id);
    expect((await sendMessage(dbA, lova, { conversationId: id, contenu: "Merci" })).ok).toBe(true);
  });

  it("« ne pas recevoir de messages » : absent de l'annuaire, nouvelle conversation refusée", async () => {
    await updatePrivacy(dbA, fara.id, { presenceVisible: true, messagesVoyageurs: false });
    expect((await listVoyageurs(dbA, lova.id, undefined, 1)).items.map((v) => v.nom)).toEqual([
      "Hery T.",
    ]);
    expect(await start(lova, fara)).toEqual({
      ok: false,
      error: "Ce voyageur ne reçoit pas de messages.",
    });
  });

  it("annuaire : prénom, initiale, photo, présence ; jamais l'e-mail ; isolé par agence", async () => {
    await touchPresence(dbA, hery.id, new Date());
    const list = await listVoyageurs(dbA, lova.id, "her", 1);
    expect(list.items).toEqual([
      { id: hery.id, nom: "Hery T.", photo: null, presence: { enLigne: true, vu: null } },
    ]);
    expect(JSON.stringify(list)).not.toContain("@example.com");
    await updatePrivacy(dbA, hery.id, { presenceVisible: false, messagesVoyageurs: true });
    expect((await listVoyageurs(dbA, lova.id, "her", 1)).items[0]!.presence.enLigne).toBe(false);
    expect((await listVoyageurs(dbB, ailleurs.id, undefined, 1)).total).toBe(0);
  });

  it("signalement : seulement un message reçu ; l'agence voit CE message", async () => {
    const res = await start(hery, lova, "Message déplacé");
    const conv = await getConversation(dbA, lova, res.ok ? res.data.conversationId : "");
    const messageId = conv!.messages[0]!.id;
    // On ne signale pas son propre message ; un tiers ne peut pas signaler.
    expect(
      (
        await reportMessage(dbA, {
          agenceId: agenceA.id,
          auteurId: hery.id,
          messageId,
          motif: null,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await reportMessage(dbA, {
          agenceId: agenceA.id,
          auteurId: fara.id,
          messageId,
          motif: null,
        })
      ).ok,
    ).toBe(false);
    const ok = await reportMessage(dbA, {
      agenceId: agenceA.id,
      auteurId: lova.id,
      messageId,
      motif: "Propos insultants",
    });
    expect(ok.ok).toBe(true);
    expect(
      await reportMessage(dbA, { agenceId: agenceA.id, auteurId: lova.id, messageId, motif: null }),
    ).toEqual({ ok: false, error: "Vous avez déjà signalé ce message." });
    const [s] = (await listSignalements(dbA, "OUVERT", 1)).items;
    expect(s).toMatchObject({
      motif: "Propos insultants",
      signalePar: "Lova T.",
      contenu: { contenu: "Message déplacé", auteur: { id: hery.id } },
    });
    expect(await raw.notification.count({ where: { utilisateurId: staff.id } })).toBe(1);
    expect((await listSignalements(dbB, undefined, 1)).total).toBe(0);
  });
});
