import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles } from "@/theme/theme";
import { fonts } from "@/theme/tokens";

import { GlassIconButton } from "./glass";

/**
 * En-tête des écrans empilés (style iOS) : bouton retour en verre, action facultative à droite,
 * puis petit surtitre et grand titre.
 */
export function ScreenHeader({
  kicker,
  title,
  right,
}: {
  kicker?: string;
  title: string;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  return (
    <View style={[s.header, { paddingTop: insets.top + 6 }]}>
      <View style={s.bar}>
        <GlassIconButton
          icon="chevron-back"
          label="Retour"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        />
        {right}
      </View>
      {kicker ? <Text style={s.kicker}>{kicker}</Text> : null}
      <Text style={s.title} accessibilityRole="header" numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: 10, backgroundColor: t.bg, gap: 2 },
    bar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    kicker: {
      fontFamily: fonts.textMedium,
      fontSize: 13,
      letterSpacing: 0.4,
      color: t.textMuted,
      textTransform: "uppercase",
    },
    title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: t.text },
  }),
);
