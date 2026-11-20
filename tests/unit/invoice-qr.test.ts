import jsQR from "jsqr";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";

import { isLocalHost, isPublicTunnelPath, isTunnelUrl } from "@/lib/network";
import { qrSvg } from "@/lib/qr";

/*
 * QR code des factures : il ne contient QUE le lien de la facture, pour que l'appareil photo
 * de n'importe quel téléphone l'ouvre (un QR de texte n'est pas ouvert par beaucoup
 * d'appareils Android). Le code se décode réellement (décodeur jsQR, comme un téléphone).
 */

const TUNNEL = "https://soutenance-demo-abc.trycloudflare.com";
const PATH = "/a/green-trek-mada/facture/cmwbwuskw00b58j1aynjp6z60?s=YKuUS7SrUCwJ-80O5OQ5lv";

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
  it("se décode exactement en lien (Wi-Fi ou tunnel), sans donnée personnelle", () => {
    for (const url of [`http://192.168.0.101:3000${PATH}`, `${TUNNEL}${PATH}`]) {
      expect(decode(url, "M")).toBe(url);
      expect(url).not.toMatch(/@|Randriamanana/);
    }
  });

  it("SVG avec une zone de silence de 4 modules (norme ISO/IEC 18004)", async () => {
    const url = `${TUNNEL}${PATH}`;
    const svg = await qrSvg(url, "M");
    const n = QRCode.create(url, { errorCorrectionLevel: "M" }).modules.size;
    expect(svg).toContain(`viewBox="0 0 ${n + 8} ${n + 8}"`);
  });
});

describe("tunnel de démonstration : seules les factures sont publiques", () => {
  it("reconnaît les hôtes locaux (ordinateur, Wi-Fi) et ceux venus d'Internet", () => {
    for (const host of [
      "localhost:3000",
      "127.0.0.1",
      "192.168.0.101:3000",
      "10.0.0.5",
      "mac.local",
      "greentrek.localhost:3000",
      null,
    ]) {
      expect(isLocalHost(host), String(host)).toBe(true);
    }
    for (const host of ["soutenance-demo-abc.trycloudflare.com", "exemple.org", "8.8.8.8"]) {
      expect(isLocalHost(host), host).toBe(false);
    }
  });

  it("par le tunnel : la facture et ses fichiers, rien d'autre", () => {
    for (const path of [
      "/a/green-trek-mada/facture/cmwbwuskw00b58j1aynjp6z60",
      "/_next/static/chunks/a.js",
      "/logo/green-trek.png",
      "/favicon.ico",
    ]) {
      expect(isPublicTunnelPath(path), path).toBe(true);
    }
    for (const path of [
      "/",
      "/connexion",
      "/dashboard",
      "/admin/agences",
      "/api/mobile/v1/connexion",
      "/a/green-trek-mada",
      "/a/green-trek-mada/mon-compte",
      "/fichiers/avatars/x.webp",
      "/a/x/facture/../../dashboard",
    ]) {
      expect(isPublicTunnelPath(path), path).toBe(false);
    }
  });

  it("adresse de tunnel valide : https et trycloudflare.com seulement", () => {
    expect(isTunnelUrl(TUNNEL)).toBe(true);
    expect(isTunnelUrl("http://abc.trycloudflare.com")).toBe(false);
    expect(isTunnelUrl("https://abc.trycloudflare.com.evil.org")).toBe(false);
    expect(isTunnelUrl("https://abc.trycloudflare.com/x")).toBe(false);
  });
});
