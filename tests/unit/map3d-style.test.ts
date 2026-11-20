import { describe, expect, it } from "vitest";

import { boundsOf, passagePoints, routeFeature, satelliteStyle } from "@/lib/map3d/style";

/** Carte 3D (étape 6a) : fond satellite et outils de tracé. */
describe("carte 3D", () => {
  it("fond : satellite, relief, eaux et sentiers réels, chaque source citée", () => {
    const style = satelliteStyle();
    expect(Object.keys(style.sources).sort()).toEqual(["osm", "relief", "satellite"]);
    for (const source of Object.values(style.sources)) {
      expect("attribution" in source && source.attribution).toBeTruthy();
    }
    const ids = style.layers.map((l) => l.id);
    expect(ids).toEqual(
      expect.arrayContaining(["eau", "cours-d-eau", "noms-eaux", "sentiers-osm"]),
    );
    // Aucune source qui demanderait une clé d'API.
    expect(JSON.stringify(style)).not.toMatch(/key=|token=/i);
  });

  it("tracé GeoJSON en longitude, latitude", () => {
    expect(
      routeFeature([
        { latitude: -17.48, longitude: 49.47 },
        { latitude: -17.5, longitude: 49.45 },
      ]).geometry.coordinates,
    ).toEqual([
      [49.47, -17.48],
      [49.45, -17.5],
    ]);
  });

  it("emprise des points, ou null sans point", () => {
    expect(boundsOf([])).toBeNull();
    expect(
      boundsOf([
        { latitude: -17.48, longitude: 49.47 },
        { latitude: -17.52, longitude: 49.44 },
      ]),
    ).toEqual([
      [49.44, -17.52],
      [49.47, -17.48],
    ]);
  });

  it("lieux de passage : points du tracé hors étapes du circuit, sans doublon", () => {
    const trace = [{ id: "a" }, { id: "x" }, { id: "b" }, { id: "x" }, { id: "y" }, { id: "c" }];
    expect(passagePoints(trace, new Set(["a", "b", "c"])).map((p) => p.id)).toEqual(["x", "y"]);
  });
});
