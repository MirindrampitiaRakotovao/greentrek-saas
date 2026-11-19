import { describe, expect, it } from "vitest";

import { presenceOf, presenceOfGroup } from "@/lib/presence";

/* Présence « en ligne » (étape 5c). */
const now = new Date("2026-11-19T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("présence", () => {
  it("en ligne moins de 2 minutes après la dernière activité", () => {
    expect(presenceOf(ago(30_000), true, now)).toEqual({ enLigne: true, vu: null });
    expect(presenceOf(ago(119_000), true, now).enLigne).toBe(true);
    expect(presenceOf(ago(121_000), true, now)).toEqual({ enLigne: false, vu: "vu il y a 2 min" });
  });

  it("« vu il y a » en minutes, heures, jours ; rien au-delà d'un mois", () => {
    expect(presenceOf(ago(45 * 60_000), true, now).vu).toBe("vu il y a 45 min");
    expect(presenceOf(ago(5 * 3_600_000), true, now).vu).toBe("vu il y a 5 h");
    expect(presenceOf(ago(3 * 86_400_000), true, now).vu).toBe("vu il y a 3 j");
    expect(presenceOf(ago(40 * 86_400_000), true, now).vu).toBeNull();
  });

  it("présence masquée ou jamais connecté : rien", () => {
    expect(presenceOf(ago(1000), false, now)).toEqual({ enLigne: false, vu: null });
    expect(presenceOf(null, true, now)).toEqual({ enLigne: false, vu: null });
  });

  it("équipe : en ligne si un membre visible l'est ; sinon le plus récent", () => {
    expect(
      presenceOfGroup(
        [
          { derniereActiviteAt: ago(10_000), presenceVisible: false },
          { derniereActiviteAt: ago(3_600_000), presenceVisible: true },
        ],
        now,
      ),
    ).toEqual({ enLigne: false, vu: "vu il y a 1 h" });
    expect(
      presenceOfGroup([{ derniereActiviteAt: ago(10_000), presenceVisible: true }], now).enLigne,
    ).toBe(true);
  });
});
