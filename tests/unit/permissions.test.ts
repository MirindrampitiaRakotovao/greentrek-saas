import { describe, expect, it } from "vitest";

import { assertCan, can, ForbiddenError, PERMISSIONS } from "@/lib/permissions";

// Vérifie la traduction de la matrice du cahier des charges §3 (C = creer, L = lire,
// M = modifier, S = supprimer).
describe("matrice des permissions (§3)", () => {
  it("SUPER_ADMIN gère agences et plans, mais ne fait que lire les données métier", () => {
    expect(can("SUPER_ADMIN", "supprimer", "agence")).toBe(true);
    expect(can("SUPER_ADMIN", "creer", "plan")).toBe(true);
    expect(can("SUPER_ADMIN", "lire", "reservation")).toBe(true);
    expect(can("SUPER_ADMIN", "modifier", "circuit")).toBe(false);
    expect(can("SUPER_ADMIN", "creer", "reservation")).toBe(false);
  });

  it("ADMIN_AGENCE a tous les droits sur son agence, sauf créer ou supprimer l'agence", () => {
    expect(can("ADMIN_AGENCE", "supprimer", "circuit")).toBe(true);
    expect(can("ADMIN_AGENCE", "creer", "utilisateur")).toBe(true);
    expect(can("ADMIN_AGENCE", "modifier", "agence")).toBe(true);
    expect(can("ADMIN_AGENCE", "supprimer", "agence")).toBe(false);
    expect(can("ADMIN_AGENCE", "modifier", "plan")).toBe(false);
  });

  it("STAFF crée, lit et modifie, mais ne supprime pas", () => {
    for (const resource of [
      "circuit",
      "etape",
      "troncon",
      "sessionDepart",
      "reservation",
      "paiement",
    ] as const) {
      expect(can("STAFF", "creer", resource)).toBe(true);
      expect(can("STAFF", "modifier", resource)).toBe(true);
      expect(can("STAFF", "supprimer", resource)).toBe(false);
    }
    expect(can("STAFF", "lire", "utilisateur")).toBe(true);
    expect(can("STAFF", "creer", "utilisateur")).toBe(false);
  });

  it("GUIDE ne fait que lire circuits, départs et réservations ; aucun paiement", () => {
    expect(can("GUIDE", "lire", "sessionDepart")).toBe(true);
    expect(can("GUIDE", "lire", "reservation")).toBe(true);
    expect(can("GUIDE", "modifier", "sessionDepart")).toBe(false);
    expect(can("GUIDE", "lire", "paiement")).toBe(false);
  });

  it("CLIENT réserve, annule, lit ses paiements et donne un avis", () => {
    expect(can("CLIENT", "creer", "reservation")).toBe(true);
    expect(can("CLIENT", "annuler", "reservation")).toBe(true);
    expect(can("CLIENT", "modifier", "reservation")).toBe(false);
    expect(can("CLIENT", "lire", "paiement")).toBe(true);
    expect(can("CLIENT", "creer", "avis")).toBe(true);
    expect(can("CLIENT", "lire", "utilisateur")).toBe(false);
  });

  it("la modération des avis est réservée à l'agence", () => {
    expect(can("ADMIN_AGENCE", "moderer", "avis")).toBe(true);
    expect(can("STAFF", "moderer", "avis")).toBe(true);
    expect(can("CLIENT", "moderer", "avis")).toBe(false);
    expect(can("SUPER_ADMIN", "moderer", "avis")).toBe(false);
  });

  it("définit une ligne pour chacun des 5 rôles", () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(
      ["ADMIN_AGENCE", "CLIENT", "GUIDE", "STAFF", "SUPER_ADMIN"].sort(),
    );
  });

  it("assertCan lève ForbiddenError en cas de refus", () => {
    expect(() => assertCan("GUIDE", "supprimer", "circuit")).toThrow(ForbiddenError);
    expect(() => assertCan("ADMIN_AGENCE", "supprimer", "circuit")).not.toThrow();
  });
});
