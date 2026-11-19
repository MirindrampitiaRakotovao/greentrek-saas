import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Village } from "@/lib/api";
import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

import { GlassIconButton } from "./glass";

/** Normalise pour la recherche (accents et casse ignorés). */
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Choix d'un village du réseau : champ qui ouvre une liste plein écran avec recherche.
 * `exclude` : villages déjà choisis ailleurs (départ, arrivée, à visiter).
 */
export function VillagePicker({
  label,
  villages,
  value,
  onChange,
  exclude = [],
  placeholder = "Choisir un village",
}: {
  label: string;
  villages: readonly Village[];
  value: string | null;
  onChange: (id: string) => void;
  exclude?: readonly string[];
  placeholder?: string;
}) {
  const s = useStyles();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = villages.find((v) => v.id === value);
  const list = useMemo(
    () => villages.filter((v) => !exclude.includes(v.id) && (!q || norm(v.nom).includes(norm(q)))),
    [villages, exclude, q],
  );

  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={s.field}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${selected?.nom ?? placeholder}`}
      >
        <Ionicons name="location-outline" size={18} color={theme.accent} />
        <Text style={[s.value, !selected && s.placeholder]} numberOfLines={1}>
          {selected?.nom ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[s.modal, { paddingTop: insets.top + 8 }]}>
          <View style={s.modalHead}>
            <GlassIconButton icon="close" label="Fermer" onPress={() => setOpen(false)} />
            <Text style={s.modalTitle}>{label}</Text>
          </View>
          <View style={s.search}>
            <Ionicons name="search-outline" size={18} color={theme.textMuted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Rechercher un village"
              placeholderTextColor={theme.textMuted}
              style={s.searchInput}
              accessibilityLabel="Rechercher un village"
              autoFocus
            />
          </View>
          <FlatList
            data={list}
            keyExtractor={(v) => v.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.id);
                  setOpen(false);
                  setQ("");
                }}
                style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
              >
                <Ionicons
                  name={item.id === value ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={theme.accent}
                />
                <Text style={s.rowText}>{item.nom}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={s.empty}>Aucun village ne correspond.</Text>}
          />
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    label: { fontFamily: fonts.textMedium, fontSize: 13, color: t.text, marginLeft: 4 },
    field: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 54,
      paddingHorizontal: 16,
      borderRadius: radius.sm + 4,
      backgroundColor: t.surfaceAlt,
    },
    value: { flex: 1, fontFamily: fonts.text, fontSize: 15, color: t.text },
    placeholder: { color: t.textMuted },
    modal: { flex: 1, backgroundColor: t.bg, paddingHorizontal: 18 },
    modalHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
    modalTitle: { fontFamily: fonts.display, fontSize: 22, color: t.text },
    search: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: t.surface,
      marginBottom: 8,
    },
    searchInput: {
      flex: 1,
      fontFamily: fonts.text,
      fontSize: 15,
      color: t.text,
      paddingVertical: 12,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
    },
    rowText: { fontFamily: fonts.textMedium, fontSize: 15, color: t.text },
    empty: { fontFamily: fonts.text, fontSize: 14, color: t.textMuted, padding: 20 },
  }),
);
