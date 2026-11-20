import * as Network from "expo-network";
import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ensureServer, onDiscovery } from "@/lib/discovery";
import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

/**
 * Garde l'adresse du site à jour sans réglage : vérification au retour dans l'application et
 * à chaque changement de réseau (autre Wi-Fi, partage de connexion), recherche si besoin ;
 * bandeau « Recherche du serveur… » pendant la recherche.
 */
export function ServerWatcher() {
  const s = useStyles();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [searching, setSearching] = useState(false);

  useEffect(() => onDiscovery(setSearching), []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Plusieurs événements rapprochés (Wi-Fi qui se reconnecte) : une seule vérification.
    const check = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void ensureServer().catch(() => null), 1500);
    };
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    const network = Network.addNetworkStateListener(check);
    return () => {
      if (timer) clearTimeout(timer);
      app.remove();
      network.remove();
    };
  }, []);

  if (!searching) return null;
  return (
    <View
      pointerEvents="none"
      style={[s.banner, { top: insets.top + 6 }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <ActivityIndicator size="small" color={theme.onPrimary} />
      <Text style={s.text}>Recherche du serveur Green Trek…</Text>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    banner: {
      position: "absolute",
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: t.primary,
      borderRadius: radius.pill,
      paddingHorizontal: 16,
      paddingVertical: 8,
      zIndex: 50,
      elevation: 8,
    },
    text: { fontFamily: fonts.textMedium, fontSize: 13, color: t.onPrimary },
  }),
);
