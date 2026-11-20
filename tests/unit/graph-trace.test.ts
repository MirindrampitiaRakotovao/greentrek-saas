import { describe, expect, it } from "vitest";

import { haversineKm } from "@/lib/graph/haversine";
import {
  attachEndpoints,
  chainPathGeometry,
  insertPoint,
  parseOsrmRoute,
  roundedLengthKm,
  simplifyTrace,
  type TracePoint,
  traceIndex,
  traceLengthKm,
} from "@/lib/graph/trace";

/** Tracés réels des tronçons (étape 6b-2) : fonctions pures. */

const A: TracePoint = [49.45, -17.49];
const B: TracePoint = [49.46, -17.48];
const C: TracePoint = [49.47, -17.49];
const ll = ([lng, lat]: TracePoint) => ({ latitude: lat, longitude: lng });

describe("longueur d'un tracé", () => {
  it("somme des distances de Haversine entre points successifs", () => {
    expect(traceLengthKm([A, B, C])).toBeCloseTo(
      haversineKm(ll(A), ll(B)) + haversineKm(ll(B), ll(C)),
      10,
    );
    expect(traceLengthKm([A])).toBe(0);
  });

  it("arrondie à 10 m et jamais nulle (RG 6)", () => {
    expect(roundedLengthKm([A, A])).toBe(0.01);
    expect(roundedLengthKm([A, B, C])).toBe(Math.round(traceLengthKm([A, B, C]) * 100) / 100);
  });
});

describe("réponse du service de trajets OSM", () => {
  const ok = {
    code: "Ok",
    routes: [{ distance: 1800, geometry: { coordinates: [A, B, C] } }],
    waypoints: [{ distance: 6.4 }, { distance: 10.2 }],
  };

  it("lit le chemin, sa longueur et la distance d'accroche aux étapes", () => {
    expect(parseOsrmRoute(ok)).toEqual({
      coordinates: [A, B, C],
      distanceKm: 1.8,
      accrocheM: [6, 10],
    });
  });

  it("null si aucun chemin ou réponse invalide", () => {
    expect(parseOsrmRoute({ code: "NoRoute", routes: [] })).toBeNull();
    expect(parseOsrmRoute({ code: "Ok", routes: [{ geometry: { coordinates: [A] } }] })).toBeNull();
    expect(parseOsrmRoute(null)).toBeNull();
    expect(parseOsrmRoute("<html>")).toBeNull();
    // Coordonnées hors limites ignorées.
    expect(
      parseOsrmRoute({ code: "Ok", routes: [{ geometry: { coordinates: [A, [999, 0]] } }] }),
    ).toBeNull();
  });
});

describe("raccord aux étapes", () => {
  it("ajoute les coordonnées exactes des étapes, sans doublon", () => {
    const from: TracePoint = [49.4499, -17.4901];
    expect(attachEndpoints([A, B], from, C)).toEqual([from, A, B, C]);
    expect(attachEndpoints([A, B, C], A, C)).toEqual([A, B, C]);
  });
});

describe("édition à la main", () => {
  it("Douglas-Peucker : retire les points alignés, garde les extrémités et les virages", () => {
    const aligned: TracePoint[] = [A, [49.455, -17.49], [49.46, -17.49], [49.465, -17.49], C];
    expect(simplifyTrace(aligned, 5)).toEqual([A, C]);
    const bend: TracePoint[] = [A, B, C];
    expect(simplifyTrace(bend, 5)).toEqual(bend);
  });

  it("insère un point dans le segment le plus proche", () => {
    const p: TracePoint = [49.466, -17.4845];
    expect(insertPoint([A, B, C], p)).toEqual([A, B, p, C]);
    const q: TracePoint = [49.454, -17.4855];
    expect(insertPoint([A, B, C], q)).toEqual([A, q, B, C]);
  });
});

describe("géométrie d'un itinéraire", () => {
  const n = (id: string, [lng, lat]: TracePoint) => ({ id, latitude: lat, longitude: lng });
  const mid: TracePoint = [49.455, -17.4];

  it("enchaîne les tracés réels, retournés si le tronçon est parcouru à l'envers", () => {
    // Tronçon b→a enregistré dans ce sens, parcouru a→b.
    const index = traceIndex([{ from: "b", to: "a", trace: [B, mid, A] }]);
    const geo = chainPathGeometry([n("a", A), n("b", B), n("c", C)], index);
    expect(geo.line).toEqual([
      [A[1], A[0]],
      [mid[1], mid[0]],
      [B[1], B[0]],
      [C[1], C[0]],
    ]);
    expect([geo.traces, geo.legs]).toEqual([1, 2]);
  });

  it("deux tronçons à sens unique gardent chacun leur tracé", () => {
    const up: TracePoint = [49.455, -17.5];
    const down: TracePoint = [49.455, -17.3];
    const index = traceIndex([
      { from: "a", to: "b", trace: [A, up, B] },
      { from: "b", to: "a", trace: [B, down, A] },
    ]);
    expect(index.get("a|b")).toEqual([A, up, B]);
    expect(index.get("b|a")).toEqual([B, down, A]);
  });

  it("sans tracé : lignes droites entre les étapes", () => {
    const geo = chainPathGeometry([n("a", A), n("c", C)], new Map());
    expect(geo.line).toEqual([
      [A[1], A[0]],
      [C[1], C[0]],
    ]);
    expect(geo.traces).toBe(0);
  });
});
