import Ionicons from "@expo/vector-icons/Ionicons";
import { Children, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

import { CountBadge } from "./badge";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Groupe de lignes arrondi (style des Réglages d'iOS), avec titre facultatif. */
export function ListGroup({ title, children }: { title?: string; children: ReactNode }) {
  const s = useStyles();
  const items = Children.toArray(children);
  return (
    <View style={{ gap: 8 }}>
      {title ? <Text style={s.groupTitle}>{title}</Text> : null}
      <View style={s.group}>
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 ? <View style={s.separator} /> : null}
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Ligne : pictogramme dans une pastille, libellé, valeur ou nombre, chevron. */
export function ListRow({
  icon,
  label,
  value,
  count = 0,
  onPress,
  danger = false,
  right,
}: {
  icon: IconName;
  label: string;
  value?: string;
  count?: number;
  onPress?: () => void;
  danger?: boolean;
  right?: ReactNode;
}) {
  const s = useStyles();
  const { theme } = useTheme();
  const color = danger ? theme.danger : theme.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={count ? `${label}, ${count} non lus` : undefined}
    >
      <View style={[s.icon, { backgroundColor: danger ? theme.dangerSoft : theme.accentSoft }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.label, danger && { color: theme.danger }]}>{label}</Text>
        {value ? (
          <Text style={s.value} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      {count > 0 ? (
        <View style={s.countWrap}>
          <CountBadge count={count} />
        </View>
      ) : null}
      {right}
      {onPress && !danger ? (
        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    groupTitle: {
      fontFamily: fonts.textMedium,
      fontSize: 12,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: t.textMuted,
      marginLeft: 16,
    },
    group: { backgroundColor: t.surface, borderRadius: radius.md, overflow: "hidden" },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginLeft: 60 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 56,
    },
    icon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    label: { fontFamily: fonts.textMedium, fontSize: 15, color: t.text },
    value: { fontFamily: fonts.text, fontSize: 12, color: t.textMuted },
    countWrap: { width: 22, height: 18 },
  }),
);
