import { describe, expect, it } from "vitest";

import { departWithinDays } from "../../mobile/src/lib/filters";
import {
  absoluteUrl,
  apiBaseFromHost,
  formatDay,
  formatDayRange,
  formatMoney,
  formatNote,
  formatPlaces,
} from "../../mobile/src/lib/format";

/* Fonctions pures de l'application mobile (après E12) : formats français, adresse de l'API. */

describe("formats de l'application mobile", () => {
  it("montants en Ariary, espaces fines insécables", () => {
    expect(formatMoney(60000)).toBe("60 000 Ar");
    expect(formatMoney(1234567, "MGA")).toBe("1 234 567 Ar");
    expect(formatMoney(950, "EUR")).toBe("950 EUR");
  });

  it("dates calendaires des départs (« 1er », mois abrégés, plages)", () => {
    expect(formatDay("2026-11-01")).toBe("1er nov. 2026");
    expect(formatDayRange("2026-11-12", "2026-11-14")).toBe("12 – 14 nov. 2026");
    expect(formatDayRange("2026-10-30", "2026-11-02")).toBe("30 oct. – 2 nov. 2026");
    expect(formatDayRange("2026-12-31", "2027-01-02")).toBe("31 déc. 2026 – 2 janv. 2027");
    expect(formatDayRange("2026-11-12", "2026-11-12")).toBe("12 nov. 2026");
  });

  it("note et places", () => {
    expect(formatNote(4.56)).toBe("4,6");
    expect(formatNote(4)).toBe("4");
    expect(formatPlaces(1)).toBe("1 place libre");
    expect(formatPlaces(3)).toBe("3 places libres");
  });

  it("adresse de l'API déduite du serveur Expo (même ordinateur, port du site)", () => {
    expect(apiBaseFromHost("192.168.1.20:8081")).toBe("http://192.168.1.20:3000");
    expect(apiBaseFromHost("exp://192.168.1.20:8081/--/")).toBe("http://192.168.1.20:3000");
    expect(apiBaseFromHost(null)).toBeNull();
    expect(absoluteUrl("http://h:3000/", "/images/a.jpg")).toBe("http://h:3000/images/a.jpg");
    expect(absoluteUrl("http://h:3000", "https://cdn/x.png")).toBe("https://cdn/x.png");
    expect(absoluteUrl("http://h:3000", null)).toBeNull();
  });

  it("« Ce mois-ci » : départ entre aujourd'hui et dans 31 jours", () => {
    const now = new Date("2026-11-09T21:00:00Z");
    expect(departWithinDays({ dateDebut: "2026-11-09" }, 31, now)).toBe(true);
    expect(departWithinDays({ dateDebut: "2026-12-10" }, 31, now)).toBe(true);
    expect(departWithinDays({ dateDebut: "2026-12-11" }, 31, now)).toBe(false);
    expect(departWithinDays({ dateDebut: "2026-11-08" }, 31, now)).toBe(false);
    expect(departWithinDays(null, 31, now)).toBe(false);
  });
});

describe("adresse du serveur saisie dans l'application", () => {
  it("normalise l'adresse (protocole, port du site par défaut) et refuse le reste", async () => {
    const { normalizeServerUrl } = await import("../../mobile/src/lib/format");
    expect(normalizeServerUrl("192.168.1.20")).toBe("http://192.168.1.20:3000");
    expect(normalizeServerUrl(" 192.168.1.20:3000/ ")).toBe("http://192.168.1.20:3000");
    expect(normalizeServerUrl("http://10.0.0.5:8080/api")).toBe("http://10.0.0.5:8080");
    expect(normalizeServerUrl("https://greentrek.example.com")).toBe(
      "https://greentrek.example.com",
    );
    expect(normalizeServerUrl("")).toBeNull();
    expect(normalizeServerUrl("ftp://serveur")).toBeNull();
    expect(normalizeServerUrl(null)).toBeNull();
  });
});
