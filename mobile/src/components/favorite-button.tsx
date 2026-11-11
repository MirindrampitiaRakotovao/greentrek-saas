import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet } from "react-native";

import { favoriteKey, useFavorites } from "@/context/favorites";
import { colors } from "@/theme/tokens";

/** Cœur des cartes et de la fiche d'un circuit (d'après la maquette). */
export function FavoriteButton({
  agence,
  circuit,
  titre,
  size = 34,
}: {
  agence: string;
  circuit: string;
  titre: string;
  size?: number;
}) {
  const { has, toggle } = useFavorites();
  const key = favoriteKey(agence, circuit);
  const on = has(key);
  return (
    <Pressable
      onPress={() => toggle(key)}
      hitSlop={8}
      style={[styles.button, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on ? `Retirer ${titre} des favoris` : `Ajouter ${titre} aux favoris`}
    >
      <Ionicons
        name={on ? "heart" : "heart-outline"}
        size={size * 0.55}
        color={on ? "#E5484D" : colors.teal900}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
});
