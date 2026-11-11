import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

export function Loading({ label = "Chargement…" }: { label?: string }) {
  const s = useStyles();
  const { theme } = useTheme();
  return (
    <View style={s.box} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={theme.accent} />
      <Text style={s.text}>{label}</Text>
    </View>
  );
}

/** Erreur réseau ou serveur, avec un bouton « Réessayer ». */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const s = useStyles();
  const { theme } = useTheme();
  return (
    <View style={s.box} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={32} color={theme.accent} />
      <Text style={s.text}>{message}</Text>
      <Pressable onPress={onRetry} style={s.button} accessibilityRole="button">
        <Text style={s.buttonText}>Réessayer</Text>
      </Pressable>
    </View>
  );
}

export function Empty({
  message,
  icon = "search-outline",
}: {
  message: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const s = useStyles();
  const { theme } = useTheme();
  return (
    <View style={s.box}>
      <View style={s.iconWrap}>
        <Ionicons name={icon} size={26} color={theme.accent} />
      </View>
      <Text style={s.text}>{message}</Text>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    box: { alignItems: "center", justifyContent: "center", gap: 12, padding: 28 },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: t.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    text: {
      fontFamily: fonts.text,
      fontSize: 14,
      lineHeight: 21,
      color: t.textMuted,
      textAlign: "center",
    },
    button: {
      backgroundColor: t.primary,
      borderRadius: radius.pill,
      paddingHorizontal: 22,
      paddingVertical: 11,
    },
    buttonText: { fontFamily: fonts.textSemiBold, color: t.onPrimary },
  }),
);
