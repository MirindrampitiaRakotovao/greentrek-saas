import { describe, expect, it } from "vitest";

import { haversineKm } from "@/lib/graph/haversine";
import { BASE_LAYERS, satellitePreviewUrl, tileFor } from "@/lib/map/tiles";

describe("haversineKm", () => {
  it("distance nulle entre un point et lui-même", () => {
    expect(
      haversineKm({ latitude: -17.49, longitude: 49.45 }, { latitude: -17.49, longitude: 49.45 }),
    ).toBe(0);
  });

  it("distance de référence Paris – Londres ≈ 343,5 km", () => {
    const paris = { latitude: 48.8566, longitude: 2.3522 };
    const londres = { latitude: 51.5074, longitude: -0.1278 };
    expect(haversineKm(paris, londres)).toBeCloseTo(343.5, 0);
  });

  it("un degré de latitude ≈ 111,2 km", () => {
    expect(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeCloseTo(
      111.19,
      1,
    );
  });

  it("Mahambo – Fénérive-Est ≈ 12,7 km (coordonnées OpenStreetMap)", () => {
    const mahambo = { latitude: -17.4896484, longitude: 49.4503963 };
    const fenerive = { latitude: -17.3820298, longitude: 49.4099713 };
    expect(haversineKm(mahambo, fenerive)).toBeCloseTo(12.7, 1);
  });

  it("est symétrique", () => {
    const a = { latitude: -17.48, longitude: 49.46 };
    const b = { latitude: -17.68, longitude: 49.51 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
  });
});

describe("tileFor", () => {
  it("retrouve la tuile 10/652/562 qui contient Mahambo (calcul vérifié à la main)", () => {
    expect(tileFor(-17.4896484, 49.4503963, 10)).toEqual({ x: 652, y: 562, z: 10 });
  });

  it("la tuile 0/0/0 contient le monde entier", () => {
    expect(tileFor(0, 0, 0)).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe("fonds de carte", () => {
  it("les vignettes des calques montrent bien la tuile de Mahambo (z=10, x=652, y=562)", () => {
    const { x, y } = tileFor(-17.4896484, 49.4503963, 10);
    for (const layer of Object.values(BASE_LAYERS)) {
      // Esri ordonne les tuiles {z}/{y}/{x}, les autres {z}/{x}/{y}.
      expect(
        layer.preview.includes(`/10/${x}/${y}`) || layer.preview.includes(`/10/${y}/${x}`),
      ).toBe(true);
    }
  });

  it("vue satellite d'un lieu : URL Esri au format {z}/{y}/{x}", () => {
    const { x, y } = tileFor(-17.4810892, 49.4627601, 15);
    expect(satellitePreviewUrl(-17.4810892, 49.4627601)).toMatch(new RegExp(`/tile/15/${y}/${x}$`));
  });
});
