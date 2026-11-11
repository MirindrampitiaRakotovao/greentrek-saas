import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles } from "@/theme/theme";
import { fonts } from "@/theme/tokens";

/** En-tête des onglets (style iOS) : petit surtitre, grand titre, action facultative. */
export function TabHeader({
  kicker,
  title,
  right,
  children,
}: {
  kicker: string;
  title: string;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  return (
    <View style={[s.header, { paddingTop: insets.top + 10 }]}>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>{kicker}</Text>
          <Text style={s.title} accessibilityRole="header">
            {title}
          </Text>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: 8, gap: 12, backgroundColor: t.bg },
    row: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
    kicker: {
      fontFamily: fonts.textMedium,
      fontSize: 13,
      letterSpacing: 0.4,
      color: t.textMuted,
      textTransform: "uppercase",
    },
    title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, color: t.text },
  }),
);
