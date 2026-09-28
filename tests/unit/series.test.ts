import { describe, expect, it } from "vitest";

import { buildSeries } from "@/lib/dashboard/series";

const NOW = new Date("2026-09-28T09:00:00Z"); // lundi 28 septembre, 12 h à Mahambo

describe("buildSeries", () => {
  it("7 jours : 7 points continus, du plus ancien à aujourd'hui, avec les jours vides à 0", () => {
    const points = buildSeries(
      [
        { at: new Date("2026-09-28T05:00:00Z"), series: "reserve", amount: 100 },
        { at: new Date("2026-09-28T06:00:00Z"), series: "reserve", amount: 50 },
        { at: new Date("2026-09-26T10:00:00Z"), series: "encaisse", amount: 30 },
      ],
      ["reserve", "encaisse"],
      "7j",
      NOW,
    );
    expect(points).toHaveLength(7);
    expect(points[0]!.key).toBe("2026-09-22");
    expect(points[6]).toMatchObject({ key: "2026-09-28", reserve: 150, encaisse: 0 });
    expect(points[4]).toMatchObject({ key: "2026-09-26", reserve: 0, encaisse: 30 });
  });

  it("regroupe en heure de Madagascar (22 h UTC = lendemain local)", () => {
    const points = buildSeries(
      [{ at: new Date("2026-09-27T22:00:00Z"), series: "reserve", amount: 10 }],
      ["reserve"],
      "7j",
      NOW,
    );
    expect(points[6]).toMatchObject({ key: "2026-09-28", reserve: 10 });
  });

  it("12 mois : 12 points mensuels, montants hors plage ignorés", () => {
    const points = buildSeries(
      [
        { at: new Date("2026-09-10T10:00:00Z"), series: "reserve", amount: 5 },
        { at: new Date("2025-10-02T10:00:00Z"), series: "reserve", amount: 7 },
        { at: new Date("2024-01-01T10:00:00Z"), series: "reserve", amount: 999 },
      ],
      ["reserve"],
      "12m",
      NOW,
    );
    expect(points).toHaveLength(12);
    expect(points[0]).toMatchObject({ key: "2025-10", reserve: 7 });
    expect(points[11]).toMatchObject({ key: "2026-09", reserve: 5 });
    expect(points.reduce((sum, p) => sum + p.reserve, 0)).toBe(12);
  });

  it("30 jours : 30 points", () => {
    expect(buildSeries([], ["reserve"], "30j", NOW)).toHaveLength(30);
  });
});
