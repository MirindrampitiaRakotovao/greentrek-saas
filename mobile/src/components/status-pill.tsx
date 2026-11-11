import { StyleSheet, Text, View } from "react-native";

import type { StatutReservation } from "@/lib/api";
import { useTheme } from "@/theme/theme";
import { fonts, STATUS_COLORS } from "@/theme/tokens";

/** Statut d'une réservation : couleur ET libellé en texte (jamais la couleur seule). */
export function StatusPill({ statut, label }: { statut: StatutReservation; label: string }) {
  const { theme } = useTheme();
  const c = STATUS_COLORS[theme.dark ? "dark" : "light"][statut];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  text: { fontFamily: fonts.textSemiBold, fontSize: 11 },
});
