import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isTunnelUrl } from "@/lib/network";

/**
 * Tunnel de démonstration (`npm run tunnel`) : le script écrit l'adresse publique du tunnel
 * (https://….trycloudflare.com) dans `.tunnel-url` à la racine du projet (ignoré par git) et
 * l'efface à l'arrêt. Relu à chaque QR code : pas besoin de redémarrer le serveur.
 */
export const TUNNEL_FILE = join(/* turbopackIgnore: true */ process.cwd(), ".tunnel-url");

export function tunnelUrl(): string | null {
  try {
    const value = readFileSync(TUNNEL_FILE, "utf8").trim();
    return isTunnelUrl(value) ? value : null;
  } catch {
    return null;
  }
}
