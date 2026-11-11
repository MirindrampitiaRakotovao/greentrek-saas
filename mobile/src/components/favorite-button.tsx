import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";

import { favoriteKey, useFavorites } from "@/context/favorites";
import { useTheme } from "@/theme/theme";

import { Glass } from "./glass";

/** Cœur en verre des cartes et de la fiche d'un circuit. */
export function FavoriteButton({
  agence,
  circuit,
  titre,
  size = 36,
}: {
  agence: string;
  circuit: string;
  titre: string;
  size?: number;
}) {
  const { has, toggle } = useFavorites();
  const { theme } = useTheme();
  const key = favoriteKey(agence, circuit);
  const on = has(key);
  return (
    <Pressable
      onPress={() => toggle(key)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? `Retirer ${titre} des favoris` : `Ajouter ${titre} aux favoris`}
    >
      <Glass rounded={size / 2} style={{ width: size, height: size }}>
        <View style={styles.center}>
          <Ionicons
            name={on ? "heart" : "heart-outline"}
            size={size * 0.52}
            color={on ? "#F04438" : theme.text}
          />
        </View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
