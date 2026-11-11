import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useMemo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CircuitRow } from "@/components/circuit-row";
import { Button } from "@/components/form";
import { ErrorState, Loading } from "@/components/states";
import { favoriteKey, useFavorites } from "@/context/favorites";
import { useAsync } from "@/hooks/use-async";
import { fetchCatalogue } from "@/lib/api";
import { colors, fonts } from "@/theme/tokens";

/** Onglet « Favoris » : circuits mis de côté (cœur), avec leurs données à jour. */
export default function FavorisScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { keys } = useFavorites();
  const { data, error, loading, reload } = useAsync(() => fetchCatalogue(), "favoris");
  // Ordre d'ajout (le plus récent d'abord) ; un circuit retiré du catalogue disparaît.
  const circuits = useMemo(() => {
    const byKey = new Map(
      (data?.circuits ?? []).map((c) => [favoriteKey(c.agence.slug, c.slug), c]),
    );
    return keys.flatMap((k) => byKey.get(k) ?? []);
  }, [data, keys]);

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.script}>Vos envies</Text>
        <Text style={styles.title} accessibilityRole="header">
          Favoris
        </Text>
      </View>
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <FlatList
          data={circuits}
          keyExtractor={(c) => favoriteKey(c.agence.slug, c.slug)}
          renderItem={({ item }) => <CircuitRow circuit={item} />}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + 24 }]}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshing={loading}
          onRefresh={reload}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={40} color={colors.teal600} />
              <Text style={styles.emptyText}>
                Touchez le cœur d’un circuit pour le retrouver ici.
              </Text>
              <Button
                label="Découvrir les circuits"
                onPress={() => router.push("/explorer")}
                style={{ alignSelf: "stretch" }}
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6 },
  script: { fontFamily: fonts.script, fontSize: 22, color: colors.teal600 },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.teal900, marginTop: -4 },
  list: { padding: 18, paddingTop: 8 },
  empty: { alignItems: "center", gap: 14, padding: 28 },
  emptyText: {
    fontFamily: fonts.text,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: "center",
  },
});
