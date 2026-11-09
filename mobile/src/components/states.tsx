import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts, radius } from "@/theme/tokens";

export function Loading({ label = "Chargement…" }: { label?: string }) {
  return (
    <View style={styles.box} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.teal700} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

/** Erreur réseau ou serveur, avec un bouton « Réessayer ». */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={32} color={colors.teal700} />
      <Text style={styles.text}>{message}</Text>
      <Pressable onPress={onRetry} style={styles.button} accessibilityRole="button">
        <Text style={styles.buttonText}>Réessayer</Text>
      </Pressable>
    </View>
  );
}

export function Empty({ message }: { message: string }) {
  return (
    <View style={styles.box}>
      <Ionicons name="search-outline" size={28} color={colors.teal600} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center", gap: 10, padding: 28 },
  text: { fontFamily: fonts.text, fontSize: 14, color: colors.muted, textAlign: "center" },
  button: {
    backgroundColor: colors.teal700,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  buttonText: { fontFamily: fonts.textSemiBold, color: colors.white },
});
