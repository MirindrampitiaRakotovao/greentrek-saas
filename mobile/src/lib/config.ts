import Constants from "expo-constants";

import { apiBaseFromHost } from "./format";

/**
 * Adresse du site Green Trek (API et images). Par ordre de priorité :
 * 1. `EXPO_PUBLIC_API_URL` (fichier `mobile/.env`), par exemple http://192.168.1.20:3000 ;
 * 2. l'ordinateur qui sert l'application en développement (même machine que le site, port
 *    3000) : le téléphone, sur le même Wi-Fi, joint le site sans réglage ;
 * 3. http://localhost:3000 (navigateur sur l'ordinateur).
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  apiBaseFromHost(Constants.expoConfig?.hostUri) ||
  "http://localhost:3000";
