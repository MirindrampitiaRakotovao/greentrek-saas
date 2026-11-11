import Ionicons from "@expo/vector-icons/Ionicons";
import { router, usePathname } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/context/auth";
import { colors, fonts } from "@/theme/tokens";

import { Button } from "./form";
import { ScreenHeader } from "./screen-header";

/**
 * Écran réservé au voyageur connecté (réservation, paiement, fiche d'une réservation). Sans
 * session : invitation à se connecter, puis retour sur cet écran.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  if (user) return children;
  return (
    <View style={styles.screen}>
      <ScreenHeader title="Connexion requise" />
      <View style={styles.body}>
        <Ionicons name="lock-closed-outline" size={36} color={colors.teal600} />
        <Text style={styles.text}>Connectez-vous avec votre compte voyageur pour continuer.</Text>
        <Button
          label="Se connecter"
          onPress={() => router.push({ pathname: "/connexion", params: { retour: pathname } })}
          style={{ alignSelf: "stretch" }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  body: { alignItems: "center", gap: 14, padding: 28 },
  text: {
    fontFamily: fonts.text,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: "center",
  },
});
