import { describe, expect, it } from "vitest";

import {
  buildPushBatches,
  isExpoPushToken,
  pushContent,
  reservationIdFromLink,
  sendExpoPush,
  unregisteredTokens,
} from "@/lib/push/expo";

/* Notifications push de l'application mobile (lot A4c) : contenu, paquets, jetons refusés. */

const notification = {
  type: "notification" as const,
  titre: "Réservation GTM-2026-0001 confirmée",
  message: "L'agence a confirmé votre réservation. Bon voyage !",
  lienUrl: "/a/green-trek-mada/mon-compte/reservations/res123",
};
const message = {
  type: "message" as const,
  conversationId: "conv1",
  sujet: "Sentier côtier · GTM-2026-0001",
  auteur: "Hery T.",
  extrait: "Le code du portail est 4521",
};

describe("notifications push", () => {
  it("reconnaît les jetons Expo et refuse le reste", () => {
    expect(isExpoPushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[abc-DEF_123]")).toBe(true);
    expect(isExpoPushToken("ExponentPushToken[]")).toBe(false);
    expect(isExpoPushToken("https://exemple.test")).toBe(false);
  });

  it("notification : titre et texte du site, destination = la réservation", () => {
    expect(reservationIdFromLink(notification.lienUrl)).toBe("res123");
    expect(reservationIdFromLink(null)).toBeNull();
    expect(pushContent(notification)).toEqual({
      title: notification.titre,
      body: notification.message,
      data: { type: "reservation", reservationId: "res123" },
    });
    expect(pushContent({ ...notification, lienUrl: null }).data).toEqual({ type: "notifications" });
  });

  it("message : auteur et sujet seulement, jamais le texte privé (écran verrouillé)", () => {
    const content = pushContent(message);
    expect(content).toEqual({
      title: "Nouveau message de Hery T.",
      body: "Sentier côtier · GTM-2026-0001",
      data: { type: "message", conversationId: "conv1" },
    });
    expect(JSON.stringify(content)).not.toContain("4521");
  });

  it("un message par téléphone (sans doublon), son et priorité haute, paquets de 100", () => {
    const tokens = Array.from({ length: 205 }, (_, i) => `ExponentPushToken[t${i}]`);
    const batches = buildPushBatches([...tokens, tokens[0]!], notification);
    expect(batches.map((b) => b.length)).toEqual([100, 100, 5]);
    expect(batches[0]![0]).toMatchObject({
      to: "ExponentPushToken[t0]",
      sound: "default",
      priority: "high",
      channelId: "alertes",
    });
  });

  it("jetons à oublier : DeviceNotRegistered seulement", () => {
    const [batch] = buildPushBatches(["A", "B", "C"], notification);
    const tickets = [
      { status: "ok", id: "1" },
      { status: "error", details: { error: "DeviceNotRegistered" } },
      { status: "error", details: { error: "MessageRateExceeded" } },
    ];
    expect(unregisteredTokens(batch!, tickets)).toEqual(["B"]);
    expect(unregisteredTokens(batch!, "réponse illisible")).toEqual([]);
  });

  it("envoi : POST au service, erreurs réseau sans conséquence", async () => {
    const batches = buildPushBatches(["A", "B"], notification);
    const calls: { url: string; body: unknown }[] = [];
    const stale = await sendExpoPush(batches, async (url, init) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return Response.json({
        data: [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }],
      });
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://exp.host/--/api/v2/push/send");
    expect(stale).toEqual(["B"]);
    await expect(
      sendExpoPush(batches, () => Promise.reject(new Error("hors ligne"))),
    ).resolves.toEqual([]);
  });
});
