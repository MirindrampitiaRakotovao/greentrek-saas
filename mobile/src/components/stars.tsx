import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

import type { Note } from "@/lib/api";
import { formatNote } from "@/lib/format";
import { useTheme } from "@/theme/theme";
import { colors, fonts } from "@/theme/tokens";

/** Note moyenne (étoile et valeur en texte : jamais la couleur seule). */
export function Stars({ note, light = false }: { note: Note; light?: boolean }) {
  const { theme } = useTheme();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Note : ${formatNote(note.moyenne)} sur 5, ${note.nombre} avis`}
    >
      <Ionicons name="star" size={14} color={light ? colors.sand300 : theme.star} />
      <Text style={[styles.text, { color: light ? colors.white : theme.text }]}>
        {formatNote(note.moyenne)} <Text style={styles.count}>({note.nombre})</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  text: { fontFamily: fonts.textMedium, fontSize: 13 },
  count: { fontFamily: fonts.text, opacity: 0.85 },
});
