import { router } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import { CircuitRow } from "@/components/circuit-row";
import { Button } from "@/components/form";
import { Empty, ErrorState, Loading } from "@/components/states";
import { TabHeader } from "@/components/tab-header";
import { favoriteKey, useFavorites } from "@/context/favorites";
import { useAsync } from "@/hooks/use-async";
import { fetchCatalogue } from "@/lib/api";
import { makeStyles } from "@/theme/theme";

/** Onglet « Favoris » : circuits mis de côté (cœur), avec leurs données à jour. */
export default function FavorisScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { keys } = useFavorites();
  const s = useStyles();
  const { data, error, loading, reload } = useAsync(() => fetchCatalogue(), "favoris");
  // Ordre d'ajout (le plus récent d'abord) ; un circuit retiré du catalogue disparaît.
  const circuits = useMemo(() => {
    const byKey = new Map(
      (data?.circuits ?? []).map((c) => [favoriteKey(c.agence.slug, c.slug), c]),
    );
    return keys.flatMap((k) => byKey.get(k) ?? []);
  }, [data, keys]);

  return (
    <View style={s.screen}>
      <TabHeader kicker="Vos envies" title="Favoris" />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <FlatList
          data={circuits}
          keyExtractor={(c) => favoriteKey(c.agence.slug, c.slug)}
          renderItem={({ item }) => <CircuitRow circuit={item} />}
          contentContainerStyle={[s.list, { paddingBottom: tabBarHeight + 24 }]}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshing={loading}
          onRefresh={reload}
          ListEmptyComponent={
            <View style={{ gap: 12 }}>
              <Empty
                icon="heart-outline"
                message="Touchez le cœur d’un circuit pour le retrouver ici."
              />
              <Button label="Découvrir les circuits" onPress={() => router.push("/explorer")} />
            </View>
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    list: { padding: 18, paddingTop: 8 },
  }),
);
