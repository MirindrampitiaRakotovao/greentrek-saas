import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { Agence } from "@/lib/api";
import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

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
  const s = useStyles();
  const { theme } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>Agence de votre compte</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {agences.map((a) => {
          const active = a.slug === value;
          return (
            <Pressable
              key={a.slug}
              onPress={() => onChange(a.slug)}
              style={[s.chip, active && s.chipActive]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              {active ? (
                <Ionicons name="checkmark-circle" size={16} color={theme.onPrimary} />
              ) : null}
              <View>
                <Text style={[s.name, active && s.nameActive]}>{a.nom}</Text>
                {a.ville ? <Text style={[s.city, active && s.cityActive]}>{a.ville}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    label: { fontFamily: fonts.textMedium, fontSize: 13, color: t.text, marginLeft: 4 },
    row: { gap: 8, paddingVertical: 2 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: radius.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: t.dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
    },
    chipActive: { backgroundColor: t.primary },
    name: { fontFamily: fonts.textSemiBold, fontSize: 14, color: t.text },
    nameActive: { color: t.onPrimary },
    city: { fontFamily: fonts.text, fontSize: 12, color: t.textMuted },
    cityActive: { color: t.onPrimary, opacity: 0.85 },
    error: { fontFamily: fonts.text, fontSize: 12, color: t.danger },
  }),
);
