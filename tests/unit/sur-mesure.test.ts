import { describe, expect, it } from "vitest";

import { parseIsoDate, toIsoDate } from "@/lib/departs";
import { suggestedDays, suggestedEnd } from "@/lib/sur-mesure";

/** Départ d'un itinéraire sur mesure (étape 9) : durée proposée, 6 h de marche par jour. */
describe("durée proposée", () => {
  it("jours de marche arrondis au supérieur, au moins un", () => {
    expect(suggestedDays(0)).toBe(1);
    expect(suggestedDays(295)).toBe(1); // 4 h 55
    expect(suggestedDays(360)).toBe(1); // 6 h pile
    expect(suggestedDays(361)).toBe(2);
    expect(suggestedDays(1330)).toBe(4); // 22 h 10
  });

  it("date de fin = début + jours − 1", () => {
    const debut = parseIsoDate("2026-12-20");
    expect(toIsoDate(suggestedEnd(debut, 295))).toBe("2026-12-20");
    expect(toIsoDate(suggestedEnd(debut, 1330))).toBe("2026-12-23");
  });
});
