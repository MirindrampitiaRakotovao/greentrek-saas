import { describe, expect, it } from "vitest";

import { connectionCount, publish, subscribe } from "@/lib/realtime/bus";
import { excerpt, type RealtimeEvent } from "@/lib/realtime/events";

const event: RealtimeEvent = { type: "notification", titre: "T", message: "M", lienUrl: null };

describe("bus temps réel (hors transaction : envoi immédiat)", () => {
  it("n'envoie un événement qu'aux onglets des utilisateurs visés", () => {
    const recus: string[] = [];
    const off1 = subscribe("u1", () => recus.push("u1-a"));
    const off2 = subscribe("u1", () => recus.push("u1-b"));
    const off3 = subscribe("u2", () => recus.push("u2"));
    publish(["u1", "u1"], event); // doublon ignoré
    expect(recus.sort()).toEqual(["u1-a", "u1-b"]);
    off1();
    off2();
    off3();
    expect(connectionCount("u1")).toBe(0);
  });

  it("un onglet en erreur n'empêche pas les autres de recevoir l'événement", () => {
    let recu = false;
    const off1 = subscribe("u3", () => {
      throw new Error("flux fermé");
    });
    const off2 = subscribe("u3", () => {
      recu = true;
    });
    publish(["u3"], event);
    expect(recu).toBe(true);
    off1();
    off2();
  });

  it("après désabonnement, plus rien n'est reçu", () => {
    let n = 0;
    const off = subscribe("u4", () => n++);
    off();
    publish(["u4"], event);
    expect(n).toBe(0);
  });

  it("extrait : espaces normalisés, texte coupé avec des points de suspension", () => {
    expect(excerpt("  Bonjour\n\n  à tous ")).toBe("Bonjour à tous");
    expect(excerpt("a".repeat(200), 10)).toBe(`${"a".repeat(9)}…`);
  });
});

describe("afterCommit", () => {
  it("diffère jusqu'à la fin de la transaction, et abandonne en cas d'échec", async () => {
    const { afterCommit, runWithCommitHooks } = await import("@/lib/after-commit");
    const log: string[] = [];
    await runWithCommitHooks(async () => {
      afterCommit(() => log.push("après"));
      log.push("pendant");
    });
    expect(log).toEqual(["pendant", "après"]);
    await expect(
      runWithCommitHooks(async () => {
        afterCommit(() => log.push("jamais"));
        throw new Error("échec");
      }),
    ).rejects.toThrow("échec");
    expect(log).toEqual(["pendant", "après"]);
  });
});
