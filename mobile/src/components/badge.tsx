import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/theme/tokens";

/** Pastille de nombre (non lus) posée sur une icône ; rien si zéro. */
export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.badge} importantForAccessibility="no-hide-descendants">
      <Text style={styles.text}>{count > 9 ? "9+" : count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { fontFamily: fonts.textSemiBold, fontSize: 10, lineHeight: 12, color: colors.white },
});
