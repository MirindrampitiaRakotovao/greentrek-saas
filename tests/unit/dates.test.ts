import { describe, expect, it } from "vitest";

import {
  calendarDate,
  daysUntil,
  dayKey,
  monthKey,
  percentChange,
  startOfDay,
  startOfMonth,
} from "@/lib/dates";

describe("calendrier de Madagascar (UTC+3)", () => {
  it("le 1er octobre à 1 h (heure locale) appartient déjà à octobre", () => {
    const instant = new Date("2026-09-30T22:00:00Z"); // 1er octobre 01:00 à Mahambo
    expect(monthKey(instant)).toBe("2026-10");
    expect(dayKey(instant)).toBe("2026-10-01");
  });

  it("minuit local correspond à 21 h UTC la veille", () => {
    expect(startOfDay(new Date("2026-09-28T09:00:00Z")).toISOString()).toBe(
      "2026-09-27T21:00:00.000Z",
    );
    expect(startOfDay(new Date("2026-09-28T09:00:00Z"), -1).toISOString()).toBe(
      "2026-09-26T21:00:00.000Z",
    );
  });

  it("début de mois, y compris en changeant d'année", () => {
    const now = new Date("2026-01-15T12:00:00Z");
    expect(startOfMonth(now).toISOString()).toBe("2025-12-31T21:00:00.000Z");
    expect(startOfMonth(now, -1).toISOString()).toBe("2025-11-30T21:00:00.000Z");
  });

  it("variation en pourcentage, avec un cas « période précédente vide »", () => {
    expect(percentChange(12, 10)).toBe(20);
    expect(percentChange(5, 10)).toBe(-50);
    expect(percentChange(3, 0)).toBeNull();
  });
});

describe("calendarDate (colonnes SQL DATE)", () => {
  it("donne minuit UTC du jour local", () => {
    // 28 septembre 23 h 30 à Mahambo = 20 h 30 UTC : le jour local est bien le 28.
    expect(calendarDate(new Date("2026-09-28T20:30:00Z")).toISOString()).toBe(
      "2026-09-28T00:00:00.000Z",
    );
    // 29 septembre 01 h à Mahambo = 28 septembre 22 h UTC : le jour local est le 29.
    expect(calendarDate(new Date("2026-09-28T22:00:00Z")).toISOString()).toBe(
      "2026-09-29T00:00:00.000Z",
    );
  });
});

describe("daysUntil", () => {
  it("arrondit au jour supérieur et ne devient jamais négatif", () => {
    const now = new Date("2026-09-28T09:00:00Z");
    expect(daysUntil(new Date("2026-10-28T09:00:00Z"), now)).toBe(30);
    expect(daysUntil(new Date("2026-09-28T10:00:00Z"), now)).toBe(1);
    expect(daysUntil(new Date("2026-09-01T00:00:00Z"), now)).toBe(0);
  });
});
