import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/theme/tokens";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Pastille ronde colorée et libellé (catégories de l'accueil, d'après la maquette). */
export function CategoryButton({
  label,
  icon,
  color,
  onPress,
}: {
  label: string;
  icon: IconName;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.item} accessibilityRole="button">
      <View style={[styles.circle, { backgroundColor: color }]}>
        <Ionicons name={icon} size={24} color={colors.white} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: "center", gap: 6, flex: 1 },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontFamily: fonts.textMedium, fontSize: 12, color: colors.teal900, textAlign: "center" },
});
