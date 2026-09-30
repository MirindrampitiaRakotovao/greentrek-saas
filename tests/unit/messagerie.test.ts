import { describe, expect, it } from "vitest";

import { isUnread, messagingSide } from "@/lib/messagerie";
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
