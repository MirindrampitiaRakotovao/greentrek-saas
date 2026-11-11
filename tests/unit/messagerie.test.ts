import { describe, expect, it } from "vitest";

import { deliveryStatus, isUnread, messagingSide, otherSideRoles } from "@/lib/messagerie";
import { can } from "@/lib/permissions";

const d = (minute: number) => new Date(Date.UTC(2026, 8, 29, 9, minute));

describe("messagerie : règles pures", () => {
  it("l'administrateur et le personnel forment un seul interlocuteur (boîte partagée)", () => {
    expect(messagingSide("ADMIN_AGENCE")).toBe(messagingSide("STAFF"));
    expect(messagingSide("GUIDE")).not.toBe(messagingSide("STAFF"));
    expect(messagingSide("CLIENT")).not.toBe(messagingSide("GUIDE"));
  });

  it("non lu : message d'un autre côté, postérieur à la dernière lecture", () => {
    const duClient = { createdAt: d(10), auteurRole: "CLIENT" as const };
    expect(isUnread("STAFF", duClient, null)).toBe(true);
    expect(isUnread("STAFF", duClient, d(5))).toBe(true);
    expect(isUnread("STAFF", duClient, d(10))).toBe(false);
    expect(isUnread("STAFF", duClient, d(15))).toBe(false);
  });

  it("jamais non lu : son propre côté, ou conversation sans message", () => {
    expect(isUnread("ADMIN_AGENCE", { createdAt: d(10), auteurRole: "STAFF" }, null)).toBe(false);
    expect(isUnread("CLIENT", { createdAt: d(10), auteurRole: "CLIENT" }, null)).toBe(false);
    expect(isUnread("CLIENT", null, null)).toBe(false);
  });

  it("permissions : l'agence, le guide et le client écrivent ; pas le super admin", () => {
    for (const role of ["ADMIN_AGENCE", "STAFF", "GUIDE", "CLIENT"] as const) {
      expect(can(role, "creer", "message")).toBe(true);
      expect(can(role, "lire", "message")).toBe(true);
    }
    expect(can("SUPER_ADMIN", "lire", "message")).toBe(false);
  });
});

describe("accusé de lecture (distribué / lu)", () => {
  const t = (minutes: number) => new Date(Date.UTC(2026, 10, 11, 9, minutes));
  const message = { createdAt: t(10), auteurRole: "CLIENT" as const };

  it("mon message : distribué tant que l'autre côté ne l'a pas lu, puis lu", () => {
    expect(deliveryStatus(message, "CLIENT", [])).toBe("DISTRIBUE");
    // Ma propre lecture (à l'envoi) ne compte pas.
    expect(deliveryStatus(message, "CLIENT", [{ luJusqua: t(10), role: "CLIENT" }])).toBe(
      "DISTRIBUE",
    );
    // L'agence a lu avant le message : pas encore lu.
    expect(deliveryStatus(message, "CLIENT", [{ luJusqua: t(5), role: "STAFF" }])).toBe(
      "DISTRIBUE",
    );
    expect(deliveryStatus(message, "CLIENT", [{ luJusqua: t(10), role: "STAFF" }])).toBe("LU");
  });

  it("boîte partagée : un seul membre de l'équipe suffit, et l'équipe voit le statut de ses collègues", () => {
    const reponse = { createdAt: t(20), auteurRole: "ADMIN_AGENCE" as const };
    expect(deliveryStatus(reponse, "STAFF", [{ luJusqua: t(21), role: "CLIENT" }])).toBe("LU");
    // Un collègue qui lit n'est pas « l'autre côté ».
    expect(deliveryStatus(reponse, "STAFF", [{ luJusqua: t(30), role: "ADMIN_AGENCE" }])).toBe(
      "DISTRIBUE",
    );
  });

  it("pas de statut sous les messages de l'autre côté", () => {
    expect(deliveryStatus(message, "STAFF", [{ luJusqua: t(30), role: "STAFF" }])).toBeNull();
  });

  it("rôles de l'autre côté (destinataires d'un accusé de lecture)", () => {
    expect(otherSideRoles("CLIENT").sort()).toEqual(["ADMIN_AGENCE", "GUIDE", "STAFF"]);
    expect(otherSideRoles("STAFF").sort()).toEqual(["CLIENT", "GUIDE"]);
    expect(otherSideRoles("GUIDE").sort()).toEqual(["ADMIN_AGENCE", "CLIENT", "STAFF"]);
  });
});
