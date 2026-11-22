import { describe, expect, it } from "vitest";

import { haversineKm } from "@/lib/graph/haversine";
import {
  ambianceForHour,
  bearingDeg,
  buildRoute,
  type LatLngPoint,
  lerpAngle,
  locateSteps,
  positionAt,
  stepNear,
} from "@/lib/visit/route";

/** Visite virtuelle (étape 8a) : géométrie de la balade. Coordonnées : valeurs de test. */
const A: LatLngPoint = [-17.49, 49.45];
const B: LatLngPoint = [-17.48, 49.45]; // au nord de A
const C: LatLngPoint = [-17.48, 49.46]; // à l'est de B
const ab = haversineKm({ latitude: A[0], longitude: A[1] }, { latitude: B[0], longitude: B[1] });

describe("balade le long du tracé", () => {
  const route = buildRoute([A, A, B, C]);

  it("distances cumulées, points doublés retirés", () => {
    expect(route.points).toEqual([A, B, C]);
    expect(route.cumulKm[1]).toBeCloseTo(ab, 10);
    expect(route.totalKm).toBeGreaterThan(ab);
  });

  it("position et cap : au milieu de A–B on va vers le nord, puis vers l'est", () => {
    const mid = positionAt(route, ab / 2);
    expect(mid.point[0]).toBeCloseTo((A[0] + B[0]) / 2, 10);
    expect(mid.bearing).toBeCloseTo(0, 1);
    expect(positionAt(route, ab + 0.1).bearing).toBeCloseTo(90, 0);
  });

  it("bornée au départ et à l'arrivée", () => {
    expect(positionAt(route, -5).point).toEqual(A);
    expect(positionAt(route, 999).point).toEqual(C);
  });

  it("étapes placées le long du tracé, sans jamais revenir en arrière", () => {
    expect(locateSteps(route, [A, B, C])).toEqual([0, route.cumulKm[1], route.totalKm]);
    // Une étape proche du départ, mais après B dans le circuit, reste après B.
    const [, second] = locateSteps(route, [B, A]);
    expect(second).toBeGreaterThanOrEqual(route.cumulKm[1]!);
  });

  it("étape proche de la position (rayon), sinon aucune", () => {
    expect(stepNear([0, 1, 2], 1.04, 0.1)).toBe(1);
    expect(stepNear([0, 1, 2], 1.5, 0.1)).toBe(-1);
  });
});

describe("caméra et ambiance", () => {
  it("cap et rotation par le plus court chemin", () => {
    expect(bearingDeg(A, B)).toBeCloseTo(0, 1);
    expect(lerpAngle(350, 10, 0.5)).toBeCloseTo(0, 10);
    expect(lerpAngle(10, 350, 0.5)).toBeCloseTo(0, 10);
  });

  it("ambiance selon l'heure de Madagascar", () => {
    expect([6, 12, 18, 23].map(ambianceForHour)).toEqual(["aube", "jour", "crepuscule", "nuit"]);
  });
});
