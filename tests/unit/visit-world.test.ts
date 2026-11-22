import { describe, expect, it } from "vitest";

import { buildRoute } from "@/lib/visit/route";
import {
  decodeTerrarium,
  inRanges,
  isVegetation,
  localProjection,
  partyOffsets,
  pirogueRanges,
  tileCorner,
  tileXY,
} from "@/lib/visit/world";

/** Monde 3D de la visite (étape 8b) : fonctions pures. Coordonnées : valeurs de test. */
describe("tuiles et altitude", () => {
  it("tuile de Mahambo Doany au zoom 14, et son coin nord-ouest", () => {
    const [x, y] = tileXY(-17.4810892, 49.4627601, 14);
    expect([Math.floor(x), Math.floor(y)]).toEqual([10443, 9000]);
    const corner = tileCorner(Math.floor(x), Math.floor(y), 14);
    expect(corner.lat).toBeGreaterThan(-17.4810892);
    expect(corner.lng).toBeLessThan(49.4627601);
    const [x2, y2] = tileXY(corner.lat, corner.lng, 14);
    expect(x2).toBeCloseTo(Math.floor(x), 9);
    expect(y2).toBeCloseTo(Math.floor(y), 9);
  });

  it("altitude Terrarium : niveau de la mer et 1 000 m", () => {
    expect(decodeTerrarium(128, 0, 0)).toBe(0);
    expect(decodeTerrarium(131, 232, 0)).toBe(1000);
  });

  it("repère local en mètres : aller-retour, est = x positif, nord = z négatif", () => {
    const p = localProjection(-17.48, 49.46);
    const [x, z] = p.toLocal(-17.47, 49.47);
    expect(x).toBeGreaterThan(1000);
    expect(z).toBeLessThan(-1000);
    const [lat, lng] = p.toLatLng(x, z);
    expect(lat).toBeCloseTo(-17.47, 9);
    expect(lng).toBeCloseTo(49.47, 9);
  });

  it("végétation : forêt oui ; eau, sable et toits non", () => {
    expect(isVegetation(45, 80, 40)).toBe(true);
    expect(isVegetation(30, 90, 120)).toBe(false);
    expect(isVegetation(210, 200, 170)).toBe(false);
    expect(isVegetation(160, 70, 60)).toBe(false);
  });
});

describe("pirogue et groupe", () => {
  const route = buildRoute([
    [-17.49, 49.45],
    [-17.48, 49.45],
    [-17.47, 49.45],
    [-17.46, 49.45],
  ]);
  const w = (lat: number, mode: "MARCHE" | "PIROGUE") => ({
    latitude: lat,
    longitude: 49.45,
    modeSuivant: mode,
  });

  it("le tronçon en pirogue devient un intervalle de la balade ; deux à la suite fusionnent", () => {
    const ranges = pirogueRanges(route, [
      w(-17.49, "MARCHE"),
      w(-17.48, "PIROGUE"),
      w(-17.47, "PIROGUE"),
      w(-17.46, "MARCHE"),
    ]);
    expect(ranges).toEqual([[route.cumulKm[1], route.totalKm]]);
    expect(inRanges(ranges, route.cumulKm[1]! + 0.1)).toBe(true);
    expect(inRanges(ranges, 0.1)).toBe(false);
  });

  it("le guide ouvre la marche, les compagnons suivent", () => {
    expect(partyOffsets(2, true)).toEqual([0.006, -0.0035, -0.007]);
    expect(partyOffsets(0, false)).toEqual([]);
  });
});
