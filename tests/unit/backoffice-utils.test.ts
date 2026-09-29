import { describe, expect, it } from "vitest";

import { formatDateTime, formatMoney } from "@/lib/format";
import { navigationFor } from "@/lib/navigation";
import { pageArgs, pageCount, parsePage } from "@/lib/pagination";

describe("navigationFor : menu selon le rôle", () => {
  const hrefs = (role: Parameters<typeof navigationFor>[0]) =>
    navigationFor(role).map((item) => item.href);

  it("ADMIN_AGENCE et STAFF voient l'équipe", () => {
    expect(hrefs("ADMIN_AGENCE")).toContain("/dashboard/equipe");
    expect(hrefs("STAFF")).toContain("/dashboard/equipe");
  });

  it("seul ADMIN_AGENCE voit les paramètres ; STAFF voit guides et partenaires", () => {
    expect(hrefs("ADMIN_AGENCE")).toContain("/dashboard/parametres");
    expect(hrefs("STAFF")).not.toContain("/dashboard/parametres");
    expect(hrefs("STAFF")).toEqual(
      expect.arrayContaining(["/dashboard/guides", "/dashboard/partenaires"]),
    );
  });

  it("GUIDE ne voit ni l'équipe, ni les guides, ni les partenaires, ni les paramètres", () => {
    // Le guide consulte les circuits et les étapes (lecture seule, matrice §3).
    expect(hrefs("GUIDE")).toEqual([
      "/dashboard",
      "/dashboard/circuits",
      "/dashboard/etapes",
      "/dashboard/itineraires",
      "/dashboard/profil",
    ]);
    // La page de performances (banc d'essai) est réservée à l'administrateur et au personnel.
    expect(hrefs("STAFF")).toContain("/dashboard/performances");
  });

  it("GUIDE ne voit pas l'équipe, mais voit son profil", () => {
    expect(hrefs("GUIDE")).not.toContain("/dashboard/equipe");
    expect(hrefs("GUIDE")).toContain("/dashboard/profil");
  });
});

describe("pagination", () => {
  it.each([
    [undefined, 1],
    ["3", 3],
    ["0", 1],
    ["-2", 1],
    ["abc", 1],
    ["1.5", 1],
    [["4", "5"], 4],
  ])("parsePage(%s) = %s", (value, expected) => {
    expect(parsePage(value)).toBe(expected);
  });

  it("calcule skip/take et le nombre de pages", () => {
    expect(pageArgs(3, 20)).toEqual({ skip: 40, take: 20 });
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(41, 20)).toBe(3);
  });
});

describe("formatDateTime", () => {
  it("affiche en français, à l'heure de Madagascar (UTC+3)", () => {
    expect(formatDateTime(new Date("2026-09-28T09:05:00Z"))).toBe("28/09/2026 12:05");
  });

  it("affiche un texte de repli pour une date absente", () => {
    expect(formatDateTime(null, "Jamais")).toBe("Jamais");
  });
});

describe("formatMoney", () => {
  // Intl sépare les milliers par une espace fine insécable (U+202F) : on normalise pour comparer.
  const plain = (text: string) => text.replace(/\s/g, " ");

  it("affiche l'Ariary avec « Ar »", () => {
    expect(plain(formatMoney(25000, "MGA"))).toBe("25 000 Ar");
  });

  it("affiche l'euro avec son symbole", () => {
    expect(plain(formatMoney(25000, "EUR"))).toBe("25 000 €");
  });

  it("affiche un texte de repli pour un montant absent", () => {
    expect(formatMoney(null, "MGA")).toBe("—");
  });
});
