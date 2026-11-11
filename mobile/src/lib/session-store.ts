import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { Session } from "./api";

/**
 * Session du voyageur (jeton et profil) conservée sur l'appareil. Sur téléphone : stockage
 * chiffré du système (Keychain sur iOS, Keystore sur Android) via expo-secure-store. Dans
 * l'aperçu web, qui n'a pas d'équivalent (le module ne fonctionne pas sur le web), elle reste
 * dans le stockage du navigateur : acceptable pour un aperçu de développement, jamais pour une
 * version publiée sur le web.
 */
const KEY = "greentrek.session";

async function readRaw(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(KEY) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(KEY);
}

/** Session enregistrée, ou `null` (aucune, ou illisible). */
export async function readSession(): Promise<Session | null> {
  try {
    const raw = await readRaw();
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Session>;
    return typeof data.token === "string" && data.user ? (data as Session) : null;
  } catch {
    return null;
  }
}

export async function writeSession(session: Session | null): Promise<void> {
  const value = session ? JSON.stringify(session) : null;
  if (Platform.OS === "web") {
    try {
      if (value) globalThis.localStorage?.setItem(KEY, value);
      else globalThis.localStorage?.removeItem(KEY);
    } catch {
      // Stockage indisponible (navigation privée) : session limitée à l'onglet.
    }
    return;
  }
  if (value) await SecureStore.setItemAsync(KEY, value);
  else await SecureStore.deleteItemAsync(KEY);
}
