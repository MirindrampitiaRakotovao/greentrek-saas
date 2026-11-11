import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { Agence } from "@/lib/api";
import { colors, fonts, radius } from "@/theme/tokens";

/**
 * Choix de l'agence du compte : un compte voyageur appartient à une agence (RG 2), comme sur le
 * site où l'on se connecte depuis le site de l'agence.
 */
export function AgencyPicker({
  agences,
  value,
  onChange,
  error,
}: {
  agences: readonly Agence[];
  value: string;
  onChange: (slug: string) => void;
  error?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>Agence de votre compte</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {agences.map((a) => {
          const active = a.slug === value;
          return (
            <Pressable
              key={a.slug}
              onPress={() => onChange(a.slug)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Text style={[styles.name, active && styles.nameActive]}>{a.nom}</Text>
              {a.ville ? (
                <Text style={[styles.city, active && styles.cityActive]}>{a.ville}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.textMedium, fontSize: 13, color: colors.teal900 },
  row: { gap: 8, paddingVertical: 2 },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.mist,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.white,
  },
  chipActive: { borderColor: colors.teal900, backgroundColor: colors.teal900 },
  name: { fontFamily: fonts.textSemiBold, fontSize: 14, color: colors.teal900 },
  nameActive: { color: colors.white },
  city: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  cityActive: { color: "rgba(255,255,255,0.85)" },
  error: { fontFamily: fonts.text, fontSize: 12, color: colors.danger },
});
