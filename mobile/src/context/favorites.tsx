import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type ReactNode, use, useEffect, useState } from "react";

/**
 * Favoris (cœur de la maquette) : circuits gardés SUR LE TÉLÉPHONE (AsyncStorage, données non
 * sensibles), sans compte, choix validé par l'étudiant. Clé d'un circuit : « agence/circuit »
 * (un même identifiant de circuit peut exister dans deux agences).
 */
const KEY = "greentrek.favoris";

type FavoritesState = {
  keys: readonly string[];
  has: (key: string) => boolean;
  toggle: (key: string) => void;
};

const FavoritesContext = createContext<FavoritesState | null>(null);

export const favoriteKey = (agence: string, circuit: string) => `${agence}/${circuit}`;

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        const list: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(list)) setKeys(list.filter((k): k is string => typeof k === "string"));
      })
      .catch(() => undefined);
  }, []);

  function toggle(key: string) {
    setKeys((current) => {
      const next = current.includes(key) ? current.filter((k) => k !== key) : [key, ...current];
      void AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }

  return (
    <FavoritesContext value={{ keys, has: (key) => keys.includes(key), toggle }}>
      {children}
    </FavoritesContext>
  );
}

export function useFavorites(): FavoritesState {
  const ctx = use(FavoritesContext);
  if (!ctx) throw new Error("useFavorites : FavoritesProvider manquant.");
  return ctx;
}
