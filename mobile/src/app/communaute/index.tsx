import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PublicationCard } from "@/components/communaute/publication-card";
import { Button } from "@/components/form";
import { RequireAuth } from "@/components/require-auth";
import { ScreenHeader } from "@/components/screen-header";
import { Empty, ErrorState, Loading } from "@/components/states";
import { useAsync } from "@/hooks/use-async";
import { ApiError, fetchFeed, type Publication } from "@/lib/api";
import { makeStyles } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

export default function CommunauteScreen() {
  return (
    <RequireAuth>
      <Communaute />
    </RequireAuth>
  );
}

/** Fil de la communauté : photos de séjour des voyageurs de toutes les agences (étape 5d). */
function Communaute() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { data, error, loading, reload } = useAsync(() => fetchFeed(1), "communaute");
  const [more, setMore] = useState<{ items: Publication[]; page: number } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      setMore(null);
      reload();
    }, [reload]),
  );

  const items = [...(data?.publications ?? []), ...(more?.items ?? [])];
  const page = more?.page ?? 1;
  const hasMore = !!data && page < data.pageCount;

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await fetchFeed(page + 1);
      setMore({ items: [...(more?.items ?? []), ...next.publications], page: next.page });
    } catch (e: unknown) {
      setMessage(e instanceof ApiError ? e.message : "Chargement impossible.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader kicker="Voyageurs de toutes les agences" title="Communauté" />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          refreshing={loading}
          onRefresh={() => {
            setMore(null);
            reload();
          }}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <View style={{ gap: 10 }}>
              <Button
                label="Partager mes photos"
                onPress={() => router.push("/communaute/nouveau")}
              />
              {message ? <Text style={styles.message}>{message}</Text> : null}
            </View>
          }
          ListHeaderComponentStyle={{ marginBottom: 14 }}
          ListEmptyComponent={<Empty message="Aucune publication pour l'instant." />}
          ListFooterComponent={loadingMore ? <Loading /> : undefined}
          renderItem={({ item }) => (
            <PublicationCard
              p={item}
              onChanged={() => {
                setMore(null);
                reload();
              }}
              onMessage={setMessage}
            />
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    list: { padding: 18, maxWidth: 640, width: "100%", alignSelf: "center" },
    message: {
      fontFamily: fonts.textMedium,
      fontSize: 13,
      color: t.accent,
      backgroundColor: t.accentSoft,
      borderRadius: radius.sm,
      padding: 10,
    },
  }),
);
