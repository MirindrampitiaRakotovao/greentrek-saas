import { describe, expect, it } from "vitest";

import {
  computeSessionStatut,
  defaultDateFin,
  parseIsoDate,
  periodsOverlap,
  placesReservees,
  toIsoDate,
} from "@/lib/departs";
import { formatDate, formatDateRange, formatMonthYear } from "@/lib/format";

const TODAY = parseIsoDate("2026-09-29");
const session = (dateFin: string, placesTotal = 8, statut: "OUVERTE" | "ANNULEE" = "OUVERTE") => ({
  statut,
  dateFin: parseIsoDate(dateFin),
  placesTotal,
});

describe("placesReservees", () => {
  it("compte les personnes des réservations non annulées", () => {
    expect(
      placesReservees([
        { nombrePersonnes: 2, statut: "CONFIRMEE" },
        { nombrePersonnes: 3, statut: "EN_ATTENTE" },
        { nombrePersonnes: 4, statut: "ANNULEE" },
        { nombrePersonnes: 1, statut: "TERMINEE" },
      ]),
    ).toBe(6);
  });
});

describe("computeSessionStatut (RG 11)", () => {
  it("OUVERTE tant qu'il reste des places", () => {
    expect(computeSessionStatut(session("2026-10-10"), 7, TODAY)).toBe("OUVERTE");
  });

  it("COMPLETE quand toutes les places sont prises", () => {
    expect(computeSessionStatut(session("2026-10-10"), 8, TODAY)).toBe("COMPLETE");
  });

  it("redevient OUVERTE si une annulation libère des places", () => {
    expect(computeSessionStatut({ ...session("2026-10-10"), statut: "OUVERTE" }, 5, TODAY)).toBe(
      "OUVERTE",
    );
  });

  it("TERMINEE une fois la date de fin passée ; pas encore le jour même", () => {
    expect(computeSessionStatut(session("2026-09-28"), 2, TODAY)).toBe("TERMINEE");
    expect(computeSessionStatut(session("2026-09-29"), 2, TODAY)).toBe("OUVERTE");
  });

  it("ANNULEE reste ANNULEE, même complète ou passée", () => {
    expect(computeSessionStatut(session("2026-09-01", 8, "ANNULEE"), 8, TODAY)).toBe("ANNULEE");
  });
});

describe("dates", () => {
  it("date de fin proposée = début + durée − 1 jour (RG 10)", () => {
    expect(toIsoDate(defaultDateFin(parseIsoDate("2026-10-10"), 1))).toBe("2026-10-10");
    expect(toIsoDate(defaultDateFin(parseIsoDate("2026-10-10"), 3))).toBe("2026-10-12");
    expect(toIsoDate(defaultDateFin(parseIsoDate("2026-10-30"), 4))).toBe("2026-11-02");
  });

  it("chevauchement de périodes (jours inclus)", () => {
    const a = { dateDebut: parseIsoDate("2026-10-10"), dateFin: parseIsoDate("2026-10-12") };
    const b = (debut: string, fin: string) => ({
      dateDebut: parseIsoDate(debut),
      dateFin: parseIsoDate(fin),
    });
    expect(periodsOverlap(a, b("2026-10-12", "2026-10-14"))).toBe(true); // même dernier jour
    expect(periodsOverlap(a, b("2026-10-08", "2026-10-10"))).toBe(true);
    expect(periodsOverlap(a, b("2026-10-13", "2026-10-14"))).toBe(false);
    expect(periodsOverlap(a, b("2026-10-01", "2026-10-09"))).toBe(false);
  });
});

describe("affichage des dates de départ (colonnes DATE, en UTC)", () => {
  const d = parseIsoDate;
  it("formate une période sans décalage de jour", () => {
    expect(formatDateRange(d("2026-10-10"), d("2026-10-10"))).toBe("10 oct. 2026");
    expect(formatDateRange(d("2026-10-10"), d("2026-10-12"))).toBe("10 – 12 oct. 2026");
    expect(formatDateRange(d("2026-10-30"), d("2026-11-02"))).toBe("30 oct. – 2 nov. 2026");
    expect(formatDateRange(d("2026-12-30"), d("2027-01-02"))).toBe("30 déc. 2026 – 2 janv. 2027");
    expect(formatMonthYear(d("2026-10-01"))).toBe("octobre 2026");
    expect(formatDate(d("2026-11-01"))).toBe("1er novembre 2026");
    expect(formatDate(d("2026-11-11"))).toBe("11 novembre 2026");
  });
});
