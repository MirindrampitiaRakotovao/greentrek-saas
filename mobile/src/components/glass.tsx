import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import {
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

import { CountBadge } from "./badge";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/**
 * Verre dépoli (refonte « glassmorphism ») : flou réel de ce qui est derrière sur iPhone
 * (`expo-blur`) ; sur Android, panneau translucide sans flou (le flou d'Android exige
 * d'envelopper le contenu flouté et coûte cher en performances). Liseré clair et coins arrondis.
 */
export function Glass({
  children,
  style,
  strong = false,
  rounded = radius.lg,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Plus opaque : texte long posé sur une photo. */
  strong?: boolean;
  rounded?: number;
}) {
  const { theme } = useTheme();
  const fill = Platform.OS === "ios" && !strong ? theme.glass.fill : theme.glass.fillSolid;
  return (
    <View
      style={[
        {
          borderRadius: rounded,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.glass.border,
        },
        style,
      ]}
    >
      {Platform.OS === "ios" ? (
        <BlurView tint={theme.glass.tint} intensity={60} style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      {children}
    </View>
  );
}

/** Bouton rond en verre (retour, favori, cloche…), avec pastille de nombre facultative. */
export function GlassIconButton({
  icon,
  onPress,
  label,
  count = 0,
  size = 44,
  color,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  count?: number;
  size?: number;
  color?: string;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
    >
      <Glass rounded={size / 2} style={{ width: size, height: size }}>
        <View style={styles.center}>
          <Ionicons name={icon} size={size * 0.48} color={color ?? theme.text} />
        </View>
      </Glass>
      <CountBadge count={count} />
    </Pressable>
  );
}

/**
 * Sélecteur à segments en verre (« Circuit / Départs / Avis », d'après les onglets de la
 * maquette) : le segment actif est souligné par l'accent.
 */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  const s = useSegmentStyles();
  return (
    <Glass rounded={radius.pill} style={s.wrap}>
      <View style={s.row} accessibilityRole="tablist">
        {options.map((o) => {
          const active = o.key === value;
          return (
            <Pressable
              key={o.key}
              onPress={() => onChange(o.key)}
              style={[s.item, active && s.itemActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[s.label, active && s.labelActive]}>{o.label}</Text>
              {active ? <View style={s.dash} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});

const useSegmentStyles = makeStyles((t) =>
  StyleSheet.create({
    wrap: { padding: 4 },
    row: { flexDirection: "row" },
    item: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: radius.pill,
      gap: 3,
    },
    itemActive: { backgroundColor: t.accentSoft },
    label: { fontFamily: fonts.textMedium, fontSize: 14, color: t.textMuted },
    labelActive: { fontFamily: fonts.textSemiBold, color: t.text },
    dash: { width: 16, height: 2.5, borderRadius: 2, backgroundColor: t.accent },
  }),
);
