import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts } from "@/theme/tokens";

/** En-tête simple des écrans empilés : bouton retour, petit titre manuscrit, titre. */
export function ScreenHeader({ kicker, title }: { kicker?: string; title: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel="Retour"
      >
        <Ionicons name="chevron-back" size={22} color={colors.teal900} />
      </Pressable>
      {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingBottom: 8, backgroundColor: colors.canvas, gap: 2 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kicker: { fontFamily: fonts.script, fontSize: 22, color: colors.teal600 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, color: colors.teal900 },
});
