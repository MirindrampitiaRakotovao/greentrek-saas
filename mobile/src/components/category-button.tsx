import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { makeStyles } from "@/theme/theme";
import { colors, fonts, radius } from "@/theme/tokens";

import { Glass } from "./glass";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Pastille de catégorie en verre : rond coloré, pictogramme et libellé. */
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
  const s = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Glass rounded={radius.pill}>
        <View style={s.row}>
          <View style={[s.dot, { backgroundColor: color }]}>
            <Ionicons name={icon} size={14} color={colors.white} />
          </View>
          <Text style={s.label}>{label}</Text>
        </View>
      </Glass>
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingLeft: 6,
      paddingRight: 14,
      paddingVertical: 6,
    },
    dot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    label: { fontFamily: fonts.textMedium, fontSize: 13, color: t.text },
  }),
);
