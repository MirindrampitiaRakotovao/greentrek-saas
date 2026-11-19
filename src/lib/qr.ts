import QRCode from "qrcode";

/**
 * QR code en SVG, généré sur le serveur (bibliothèque `qrcode`, MIT) à partir d'un texte qui
 * vient de NOS données (jamais d'une saisie libre).
 * - marge de 4 modules (zone de silence exigée par la norme ISO/IEC 18004) : sans elle,
 *   l'appareil photo d'un téléphone peine à repérer le code ;
 * - niveau de correction « L » pour un long texte (code moins dense, plus facile à lire à
 *   l'écran), « M » pour un simple lien.
 */
export function qrSvg(text: string, level: "L" | "M" = "M"): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: level,
    margin: 4,
    color: { dark: "#0f414d", light: "#ffffff" },
  });
}
