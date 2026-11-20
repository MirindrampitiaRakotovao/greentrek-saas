import * as Network from "expo-network";
import { Platform } from "react-native";

import { deviceIPv4Addresses } from "../../modules/network-addresses";

import { apiBaseUrl, setApiBaseUrl } from "./config";
import {
  candidateHosts,
  DISCOVERY_PATH,
  findServer,
  isGreenTrekMark,
  serverUrl,
} from "./discovery-core";

/**
 * Recherche automatique du site Green Trek (application installée) : quand l'adresse de
 * l'ordinateur change (autre Wi-Fi, partage de connexion du téléphone), l'application
 * parcourt son réseau local, garde l'adresse qui répond « greentrek » et la mémorise.
 * Une seule recherche à la fois ; les écrans peuvent afficher « Recherche du serveur… ».
 */

/** Le site répond-il, et est-ce bien Green Trek ? (délai court : réseau local) */
export async function probeServer(base: string, timeoutMs = 900): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${DISCOVERY_PATH}`, { signal: controller.signal });
    return res.ok && isGreenTrekMark(await res.json());
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Adresses IPv4 du téléphone : toutes ses interfaces (APK) et son adresse Wi-Fi. */
async function phoneAddresses(): Promise<string[]> {
  const all = new Set(deviceIPv4Addresses());
  try {
    const wifi = await Network.getIpAddressAsync();
    if (wifi && wifi !== "0.0.0.0") all.add(wifi);
  } catch {
    // Adresse Wi-Fi indisponible : celles du module natif suffisent.
  }
  return [...all];
}

let running: Promise<string | null> | null = null;
const listeners = new Set<(searching: boolean) => void>();

/** Abonnement à l'état de la recherche (bandeau « Recherche du serveur… »). */
export function onDiscovery(listener: (searching: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Cherche le site sur le réseau local ; l'adresse trouvée devient l'adresse utilisée. */
export function rediscover(): Promise<string | null> {
  // Dans le navigateur (aperçu web), l'adresse du site est déjà connue.
  if (Platform.OS === "web") return Promise.resolve(null);
  running ??= (async () => {
    listeners.forEach((l) => l(true));
    try {
      const hosts = candidateHosts(await phoneAddresses());
      const found = await findServer(
        hosts.map((h) => serverUrl(h)),
        (u) => probeServer(u),
        {
          preferred: apiBaseUrl(),
        },
      );
      if (found && found !== apiBaseUrl()) await setApiBaseUrl(found);
      return found;
    } finally {
      listeners.forEach((l) => l(false));
      running = null;
    }
  })();
  return running;
}

/** Vérifie l'adresse actuelle ; si elle ne répond plus, cherche la nouvelle. */
export async function ensureServer(): Promise<string | null> {
  if (await probeServer(apiBaseUrl(), 1500)) return apiBaseUrl();
  return rediscover();
}
