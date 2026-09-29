import { describe, expect, it } from "vitest";

import { toCsv } from "@/lib/csv";
import { invoiceNumber, signInvoice, verifyInvoiceSignature } from "@/lib/invoice";

describe("signature des factures (lien du QR code)", () => {
  const secret = "secret-de-test";
  const sig = signInvoice(secret, "agenceA", "resa1");

  it("accepte la signature de la bonne réservation", () => {
    expect(sig).toHaveLength(22);
    expect(verifyInvoiceSignature(secret, "agenceA", "resa1", sig)).toBe(true);
  });

  it("refuse une autre réservation, une autre agence, un autre secret ou une signature forgée", () => {
    expect(verifyInvoiceSignature(secret, "agenceA", "resa2", sig)).toBe(false);
    expect(verifyInvoiceSignature(secret, "agenceB", "resa1", sig)).toBe(false);
    expect(verifyInvoiceSignature("autre-secret", "agenceA", "resa1", sig)).toBe(false);
    expect(verifyInvoiceSignature(secret, "agenceA", "resa1", "A".repeat(22))).toBe(false);
    expect(verifyInvoiceSignature(secret, "agenceA", "resa1", undefined)).toBe(false);
    expect(verifyInvoiceSignature(secret, "agenceA", "resa1", `${sig}x`)).toBe(false);
  });

  it("numéro de facture dérivé de la référence", () => {
    expect(invoiceNumber("GTM-2026-VZBDA4")).toBe("F-GTM-2026-VZBDA4");
  });
});

describe("export CSV", () => {
  it("séparateur ; et échappement des guillemets, ; et retours à la ligne", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          ["x;y", 'dit "bonjour"'],
          ["ligne\nsuivante", 12],
        ],
      ),
    ).toBe('a;b\r\n"x;y";"dit ""bonjour"""\r\n"ligne\nsuivante";12');
  });

  it("neutralise les formules de tableur (injection CSV)", () => {
    expect(toCsv(["nom"], [['=HYPERLINK("http://x")'], ["-2+3"], ["@SOMME"]])).toBe(
      'nom\r\n"\'=HYPERLINK(""http://x"")"\r\n\'-2+3\r\n\'@SOMME',
    );
    expect(toCsv(["n"], [[-5], [null]])).toBe("n\r\n-5\r\n"); // nombres négatifs intacts
  });
});
