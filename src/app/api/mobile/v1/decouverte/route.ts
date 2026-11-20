import { json, preflight } from "@/lib/mobile/http";

/**
 * Découverte du serveur par l'application installée (APK) : quand l'adresse de l'ordinateur
 * change (autre Wi-Fi, partage de connexion du téléphone), l'application interroge les
 * adresses voisines et garde celle qui répond « greentrek ». Réponse fixe, publique et sans
 * accès à la base : rien d'autre n'est révélé.
 */
const DISCOVERY_MARK = { service: "greentrek", api: "v1" } as const;

export function GET() {
  return json(DISCOVERY_MARK);
}

export const OPTIONS = preflight;
