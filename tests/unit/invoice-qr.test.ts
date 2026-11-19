import jsQR from "jsqr";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";

import { invoiceQrText } from "@/lib/invoice";
import { qrSvg } from "@/lib/qr";

/*
 * QR code des factures (étape « QR codes », après E12) : les informations essentielles sont
 * lisibles sans réseau ; le code se décode réellement (décodeur jsQR, comme un téléphone).
 */

const sample = {
  numero: "F-GTM-2026-0159",
  etat: "Facture acquittée",
  agence: "Green Trek Mada",
  reference: "GTM-2026-0159",
  circuit: "Sentier Mahambo Doany – Ambodiforaha",
  dates: "14 – 15 nov. 2026",
  personnes: 2,
  total: "360 000 Ar",
  paye: "360 000 Ar",
  reste: "0 Ar",
  emiseLe: "19 nov. 2026",
  url: "http://192.168.0.101:3000/a/green-trek-mada/facture/cmwbwuskw00b58j1aynjp6z60?s=YKuUS7SrUCwJ-80O5OQ5lv",
};

/** Image du QR code (4 pixels par module, marge de 4 modules) puis décodage. */
function decode(text: string, level: "L" | "M"): string | null {
  const qr = QRCode.create(text, { errorCorrectionLevel: level });
  const n = qr.modules.size;
  const scale = 4;
  const margin = 4;
  const size = (n + 2 * margin) * scale;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!qr.modules.get(y, x)) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + margin) * scale + dy) * size + (x + margin) * scale + dx) * 4;
          pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
        }
      }
    }
  }
  return jsQR(pixels, size, size)?.data ?? null;
}

describe("QR code des factures", () => {
  it("contient les informations essentielles, sans donnée personnelle du client", () => {
    const text = invoiceQrText(sample);
    expect(text.split("\n")).toEqual([
      "FACTURE F-GTM-2026-0159",
      "Facture acquittée",
      "Green Trek Mada",
      "Réservation GTM-2026-0159",
      "Sentier Mahambo Doany – Ambodiforaha",
      "Départ : 14 – 15 nov. 2026 · 2 pers.",
      "Total : 360 000 Ar",
      "Payé : 360 000 Ar · Reste : 0 Ar",
      "Émise le 19 nov. 2026",
      `En ligne (même Wi-Fi) : ${sample.url}`,
    ]);
    expect(text).not.toMatch(/@|Randriamanana/);
  });

  it("se décode réellement en ce texte (accents et espaces compris)", () => {
    const text = invoiceQrText(sample);
    expect(decode(text, "L")).toBe(text);
  });

  it("SVG avec une zone de silence de 4 modules (norme ISO/IEC 18004)", async () => {
    const text = invoiceQrText(sample);
    const svg = await qrSvg(text, "L");
    const n = QRCode.create(text, { errorCorrectionLevel: "L" }).modules.size;
    expect(svg).toContain(`viewBox="0 0 ${n + 8} ${n + 8}"`);
  });
});
