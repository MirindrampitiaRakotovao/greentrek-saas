import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CircuitRow } from "@/components/circuit-row";
import { Empty, ErrorState, Loading } from "@/components/states";
import { useAsync } from "@/hooks/use-async";
import { type CircuitResume, fetchCatalogue } from "@/lib/api";
import { departWithinDays } from "@/lib/filters";
import { colors, fonts, radius } from "@/theme/tokens";

type Difficulte = CircuitResume["difficulte"];

const FILTRES: { key: Difficulte | "PROCHES" | null; label: string }[] = [
  { key: null, label: "Tous" },
  { key: "FACILE", label: "Facile" },
  { key: "MOYENNE", label: "Moyenne" },
  { key: "DIFFICILE", label: "Difficile" },
  { key: "PROCHES", label: "Ce mois-ci" },
];

/**
 * Explorer : tous les circuits de la plateforme, recherche et filtres. Les filtres choisis sur
 * l'accueil arrivent en paramètres ; l'onglet restant monté, une clé le réinitialise quand ils
 * changent.
 */
export default function ExplorerScreen() {
  const params = useLocalSearchParams<{ q?: string; difficulte?: Difficulte; proches?: string }>();
  const initial = {
    q: params.q ?? "",
    filtre: params.proches === "1" ? ("PROCHES" as const) : (params.difficulte ?? null),
  };
  return <Explorer key={`${initial.q}|${initial.filtre ?? ""}`} initial={initial} />;
}

function Explorer({ initial }: { initial: { q: string; filtre: Difficulte | "PROCHES" | null } }) {
  const tabBarHeight = useBottomTabBarHeight();
  const [text, setText] = useState(initial.q);
  const [q, setQ] = useState(initial.q);
  const [filtre, setFiltre] = useState<Difficulte | "PROCHES" | null>(initial.filtre);

  // Recherche lancée 350 ms après la dernière frappe.
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 350);
    return () => clearTimeout(timer);
  }, [text]);

  const difficulte = filtre && filtre !== "PROCHES" ? filtre : undefined;
  const { data, error, loading, reload } = useAsync(
    () => fetchCatalogue({ q: q || undefined, difficulte }),
    `${q}|${difficulte ?? ""}`,
  );
  const circuits = useMemo(
    () =>
      (data?.circuits ?? []).filter(
        (c) => filtre !== "PROCHES" || departWithinDays(c.prochainDepart, 31, new Date()),
      ),
    [data, filtre],
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.script}>Toutes les agences</Text>
        <Text style={styles.title} accessibilityRole="header">
          Explorer
        </Text>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={20} color={colors.muted} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Circuit, agence, ville…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            returnKeyType="search"
            accessibilityLabel="Rechercher un circuit"
          />
          {text ? (
            <Pressable onPress={() => setText("")} accessibilityLabel="Effacer la recherche">
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <FlatList
          horizontal
          data={FILTRES}
          keyExtractor={(f) => f.label}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => {
            const active = filtre === item.key;
            return (
              <Pressable
                onPress={() => setFiltre(item.key)}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Loading label="Recherche des circuits…" />
      ) : (
        <FlatList
          data={circuits}
          keyExtractor={(c) => `${c.agence.slug}/${c.slug}`}
          renderItem={({ item }) => <CircuitRow circuit={item} />}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + 24 }]}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshing={loading}
          onRefresh={reload}
          ListHeaderComponent={
            <Text style={styles.count}>
              {circuits.length} circuit{circuits.length > 1 ? "s" : ""}
            </Text>
          }
          ListEmptyComponent={<Empty message="Aucun circuit ne correspond à votre recherche." />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: 18, paddingTop: 8, gap: 10 },
  script: { fontFamily: fonts.script, fontSize: 22, color: colors.teal600 },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.teal900, marginTop: -8 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    fontFamily: fonts.text,
    fontSize: 14,
    color: colors.teal900,
    paddingVertical: 10,
  },
  chips: { gap: 8, paddingVertical: 4 },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.mist,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.teal900, borderColor: colors.teal900 },
  chipText: { fontFamily: fonts.textMedium, fontSize: 13, color: colors.teal900 },
  chipTextActive: { color: colors.white },
  list: { padding: 18, paddingTop: 6 },
  count: { fontFamily: fonts.text, fontSize: 13, color: colors.muted, marginBottom: 10 },
});
