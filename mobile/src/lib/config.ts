import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { apiBaseFromHost, normalizeServerUrl } from "./format";

export { normalizeServerUrl };

/**
 * Adresse du site Green Trek (API et images). Par ordre de priorité :
 * 1. l'adresse choisie dans l'application (onglet Compte, « Adresse du serveur »), mémorisée
 *    sur le téléphone : indispensable pour l'application installée (APK), qui n'a pas de
 *    serveur de développement pour la guider, et dont le Wi-Fi change d'un lieu à l'autre ;
 * 2. `EXPO_PUBLIC_API_URL` (fichier `mobile/.env`, ou `eas.json` pour l'APK) ;
 * 3. l'ordinateur qui sert l'application en développement (même machine que le site, port
 *    3000) : le téléphone, sur le même Wi-Fi, joint le site sans réglage ;
 * 4. http://localhost:3000 (navigateur sur l'ordinateur).
 */
export const DEFAULT_API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  apiBaseFromHost(Constants.expoConfig?.hostUri) ||
  "http://localhost:3000";

let override: string | null = null;

/** Adresse du site actuellement utilisée. */
export function apiBaseUrl(): string {
  return override ?? DEFAULT_API_BASE_URL;
}

const KEY = "greentrek.server";

async function readStored(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return globalThis.localStorage?.getItem(KEY) ?? null;
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

/** Relit l'adresse choisie (au démarrage, avant le premier écran). */
export async function loadApiBaseUrl(): Promise<void> {
  override = normalizeServerUrl(await readStored());
}

/** Enregistre l'adresse choisie (`null` : revenir à l'adresse par défaut). */
export async function setApiBaseUrl(value: string | null): Promise<void> {
  override = value;
  try {
    if (Platform.OS === "web") {
      if (value) globalThis.localStorage?.setItem(KEY, value);
      else globalThis.localStorage?.removeItem(KEY);
    } else if (value) await SecureStore.setItemAsync(KEY, value);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Non mémorisée : appliquée jusqu'à la fermeture de l'application.
  }
}
