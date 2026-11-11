import { StyleSheet, Text, View } from "react-native";

import type { StatutReservation } from "@/lib/api";
import { colors, fonts } from "@/theme/tokens";

const STYLES: Record<StatutReservation, { bg: string; fg: string }> = {
  EN_ATTENTE: { bg: colors.sand200, fg: colors.teal900 },
  CONFIRMEE: { bg: "#D1FADF", fg: "#05603A" },
  ANNULEE: { bg: colors.mist, fg: colors.teal900 },
  TERMINEE: { bg: colors.teal100, fg: colors.teal800 },
};

/** Statut d'une réservation : couleur ET libellé en texte (jamais la couleur seule). */
export function StatusPill({ statut, label }: { statut: StatutReservation; label: string }) {
  const s = STYLES[statut];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <Text style={[styles.text, { color: s.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  text: { fontFamily: fonts.textSemiBold, fontSize: 11 },
});
