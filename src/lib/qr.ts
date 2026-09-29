import "server-only";

import QRCode from "qrcode";

/**
 * QR code en SVG, généré sur le serveur (bibliothèque `qrcode`, licence MIT) : aucun appel à
 * un service externe, fonctionne hors ligne. Niveau de correction M (15 % de redondance) :
 * scannable même imprimé ou photographié de travers. Couleur teal foncé, contraste suffisant.
 */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#0f414d", light: "#ffffff" },
  });
}
