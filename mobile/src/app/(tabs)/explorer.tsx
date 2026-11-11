import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { CircuitRow } from "@/components/circuit-row";
import { Glass } from "@/components/glass";
import { Empty, ErrorState, Loading } from "@/components/states";
import { TabHeader } from "@/components/tab-header";
import { useAsync } from "@/hooks/use-async";
import { type CircuitResume, fetchCatalogue } from "@/lib/api";
import { departWithinDays } from "@/lib/filters";
import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

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
  const s = useStyles();
  const { theme } = useTheme();
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
    <View style={s.screen}>
      <TabHeader kicker="Toutes les agences" title="Explorer">
        <Glass rounded={radius.pill}>
          <View style={s.search}>
            <Ionicons name="search-outline" size={20} color={theme.textMuted} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Circuit, agence, ville…"
              placeholderTextColor={theme.textMuted}
              style={s.input}
              returnKeyType="search"
              accessibilityLabel="Rechercher un circuit"
            />
            {text ? (
              <Pressable onPress={() => setText("")} accessibilityLabel="Effacer la recherche">
                <Ionicons name="close-circle" size={20} color={theme.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </Glass>
        <FlatList
          horizontal
          data={FILTRES}
          keyExtractor={(f) => f.label}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chips}
          renderItem={({ item }) => {
            const active = filtre === item.key;
            return (
              <Pressable
                onPress={() => setFiltre(item.key)}
                style={[s.chip, active && s.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{item.label}</Text>
              </Pressable>
            );
          }}
        />
      </TabHeader>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Loading label="Recherche des circuits…" />
      ) : (
        <FlatList
          data={circuits}
          keyExtractor={(c) => `${c.agence.slug}/${c.slug}`}
          renderItem={({ item }) => <CircuitRow circuit={item} />}
          contentContainerStyle={[s.list, { paddingBottom: tabBarHeight + 24 }]}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshing={loading}
          onRefresh={reload}
          ListHeaderComponent={
            <Text style={s.count}>
              {circuits.length} circuit{circuits.length > 1 ? "s" : ""}
            </Text>
          }
          ListEmptyComponent={<Empty message="Aucun circuit ne correspond à votre recherche." />}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    search: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 18,
      paddingVertical: 2,
    },
    input: { flex: 1, fontFamily: fonts.text, fontSize: 15, color: t.text, paddingVertical: 12 },
    chips: { gap: 8, paddingVertical: 2 },
    chip: {
      borderRadius: radius.pill,
      backgroundColor: t.surface,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    chipActive: { backgroundColor: t.primary },
    chipText: { fontFamily: fonts.textMedium, fontSize: 13, color: t.text },
    chipTextActive: { color: t.onPrimary },
    list: { padding: 18, paddingTop: 8 },
    count: { fontFamily: fonts.text, fontSize: 13, color: t.textMuted, marginBottom: 10 },
  }),
);
