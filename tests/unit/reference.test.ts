import { describe, expect, it } from "vitest";

import { firstBookableDate, parseIsoDate, toIsoDate } from "@/lib/departs";
import { generateReference, referencePrefix } from "@/lib/reference";

describe("référence de réservation", () => {
  it("préfixe : initiales du slug de l'agence (3 au plus)", () => {
    expect(referencePrefix("green-trek-mada")).toBe("GTM");
    expect(referencePrefix("demo-alpha")).toBe("DA");
    expect(referencePrefix("agence-du-grand-sud-est")).toBe("ADG");
    expect(referencePrefix("")).toBe("RES");
  });

  it("format lisible, sans caractère ambigu (0, O, 1, I, L)", () => {
    expect(generateReference("GTM", 2026, () => 0)).toBe("GTM-2026-AAAAAA");
    for (let i = 0; i < 200; i += 1) {
      const ref = generateReference("GTM", 2026);
      expect(ref).toMatch(/^GTM-2026-[A-HJKMNP-Z2-9]{6}$/);
      expect(ref.length).toBeLessThanOrEqual(20); // colonne VARCHAR(20)
    }
  });
});

describe("premier jour réservable (RG 15, décision D)", () => {
  it("un départ du jour a commencé : on réserve à partir de demain", () => {
    expect(toIsoDate(firstBookableDate(parseIsoDate("2026-09-29")))).toBe("2026-09-30");
    expect(toIsoDate(firstBookableDate(parseIsoDate("2026-12-31")))).toBe("2027-01-01");
  });
});
