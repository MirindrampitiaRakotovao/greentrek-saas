import { describe, expect, it } from "vitest";

import { COEFFICIENT_SINUOSITE } from "@/lib/graph/config";
import { estimateDistanceKm, estimateDurationMinutes } from "@/lib/graph/estimation";
import { haversineKm } from "@/lib/graph/haversine";

const mahambo = { latitude: -17.4896484, longitude: 49.4503963 };
const doany = { latitude: -17.4810892, longitude: 49.4627601 };

describe("estimateDistanceKm", () => {
  it("= distance à vol d'oiseau × 1,3, arrondie à 10 m", () => {
    const expected = Math.round(haversineKm(mahambo, doany) * COEFFICIENT_SINUOSITE * 100) / 100;
    expect(estimateDistanceKm(mahambo, doany)).toBe(expected);
    expect(estimateDistanceKm(mahambo, doany)).toBeCloseTo(2.1, 1); // 1,62 km × 1,3
  });

  it("accepte un autre coefficient", () => {
    expect(estimateDistanceKm(mahambo, doany, 1)).toBeCloseTo(1.62, 2);
  });

  it("n'est jamais nulle (RG 6 : distance strictement positive)", () => {
    expect(estimateDistanceKm(mahambo, mahambo)).toBe(0.01);
  });
});

describe("estimateDurationMinutes (Naismith adaptée : 4 km/h + 1 h par 600 m D+)", () => {
  it("sur le plat : 8 km → 120 min", () => {
    expect(estimateDurationMinutes(8)).toBe(120);
  });

  it("montée : 4 km et 300 m de D+ → 60 + 30 = 90 min", () => {
    expect(estimateDurationMinutes(4, 300)).toBe(90);
  });

  it("une descente ne rallonge pas la durée", () => {
    expect(estimateDurationMinutes(4, -300)).toBe(60);
  });

  it("arrondit à la minute supérieure, au moins 1 minute", () => {
    expect(estimateDurationMinutes(2.1)).toBe(32); // 31,5 min
    expect(estimateDurationMinutes(0.01)).toBe(1);
  });
});
