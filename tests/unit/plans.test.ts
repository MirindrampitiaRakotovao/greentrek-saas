import { describe, expect, it } from "vitest";

import { parseIsoDate } from "@/lib/departs";
import { effectiveStatut, planRefusal } from "@/lib/plans";

const TODAY = parseIsoDate("2026-09-30");
const plan = { nom: "Essai", maxCircuits: 3, maxUtilisateurs: 3, maxSessionsActives: 5 };

describe("statut effectif d'un abonnement", () => {
  it("un essai ou un abonnement actif dont la date de fin est passée est expiré", () => {
    expect(effectiveStatut({ statut: "ESSAI", dateFin: parseIsoDate("2026-09-29") }, TODAY)).toBe(
      "EXPIRE",
    );
    expect(effectiveStatut({ statut: "ACTIF", dateFin: parseIsoDate("2026-09-30") }, TODAY)).toBe(
      "ACTIF",
    ); // dernier jour inclus
    expect(effectiveStatut({ statut: "ACTIF", dateFin: null }, TODAY)).toBe("ACTIF"); // sans échéance
    expect(effectiveStatut({ statut: "ANNULE", dateFin: null }, TODAY)).toBe("ANNULE");
  });
});

describe("limites du plan (RG 18)", () => {
  it("autorise sous la limite, refuse au-delà", () => {
    expect(planRefusal({ statut: "ESSAI", plan }, "circuits", 2)).toBeNull();
    expect(planRefusal({ statut: "ESSAI", plan }, "circuits", 3)).toContain(
      "3 circuits au maximum",
    );
    expect(planRefusal({ statut: "ACTIF", plan }, "departs", 4)).toBeNull();
    expect(planRefusal({ statut: "ACTIF", plan }, "departs", 5)).toContain("5 départs actifs");
  });

  it("décision B : abonnement expiré ou annulé → créations bloquées", () => {
    expect(planRefusal({ statut: "EXPIRE", plan }, "circuits", 0)).toContain("expiré");
    expect(planRefusal({ statut: "ANNULE", plan }, "utilisateurs", 0)).toContain("annulé");
  });

  it("décision C : agence sans abonnement → pas de limite", () => {
    expect(planRefusal(null, "circuits", 1000)).toBeNull();
  });
});
