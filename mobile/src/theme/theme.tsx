import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";

import { resolveTheme, type Theme, type ThemePreference } from "./tokens";

/**
 * Thème clair ou sombre : par défaut celui du téléphone, sinon le choix fait dans l'onglet
 * Compte (« Système / Clair / Sombre »), mémorisé sur le téléphone.
 */

type ThemeState = {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
};

const KEY = "greentrek.theme";
const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === "light" || v === "dark" || v === "system") setPref(v);
      })
      .catch(() => undefined);
  }, []);

  const setPreference = useCallback((value: ThemePreference) => {
    setPref(value);
    AsyncStorage.setItem(KEY, value).catch(() => undefined);
  }, []);

  const theme = resolveTheme(preference, system);
  const value = useMemo(
    () => ({ theme, preference, setPreference }),
    [theme, preference, setPreference],
  );
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeState {
  const ctx = use(ThemeContext);
  if (!ctx) throw new Error("useTheme : ThemeProvider manquant.");
  return ctx;
}

/**
 * Feuilles de style dépendant du thème : `const useStyles = makeStyles((t) => ({ … }))`, puis
 * `const s = useStyles()` dans le composant (recalculées seulement au changement de thème).
 */
export function makeStyles<T>(factory: (t: Theme) => T): () => T {
  const cache = new WeakMap<Theme, T>();
  return function useStyles() {
    const { theme } = useTheme();
    let styles = cache.get(theme);
    if (!styles) {
      styles = factory(theme);
      cache.set(theme, styles);
    }
    return styles;
  };
}
