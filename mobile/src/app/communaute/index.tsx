import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { PublicationCard } from "@/components/communaute/publication-card";
import { Button } from "@/components/form";
import { Segmented } from "@/components/glass";
import { RequireAuth } from "@/components/require-auth";
import { ScreenHeader } from "@/components/screen-header";
import { Empty, ErrorState, Loading } from "@/components/states";
import { useAuth } from "@/context/auth";
import { useAsync } from "@/hooks/use-async";
import {
  ApiError,
  fetchCommunityHome,
  fetchFeed,
  type FeedFilters,
  imageUrl,
  type Publication,
} from "@/lib/api";
import { makeStyles, useTheme } from "@/theme/theme";
import { colors, fonts, radius } from "@/theme/tokens";

export default function CommunauteScreen() {
  return (
    <RequireAuth>
      <Communaute />
    </RequireAuth>
  );
}

const TRIS = [
  { key: "populaires", label: "Populaires" },
  { key: "recentes", label: "Récentes" },
] as const;

/**
 * Fil de la communauté (toutes les agences) : mon profil et mes chiffres, recherche,
 * destinations (un toucher filtre le fil), « Populaires » / « Récentes », défilement infini.
 */
function Communaute() {
  const styles = useStyles();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [filters, setFilters] = useState<FeedFilters>({ tri: "recentes" });
  const [search, setSearch] = useState("");
  const key = JSON.stringify(filters);
  const home = useAsync(() => fetchCommunityHome(), "communaute-accueil");
  const { data, error, loading, reload } = useAsync(() => fetchFeed(1, filters), `feed#${key}`);
  const [more, setMore] = useState<{ key: string; items: Publication[]; page: number } | null>(
    null,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const extra = more?.key === key ? more : null;

  useFocusEffect(
    useCallback(() => {
      setMore(null);
      reload();
      home.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reload]),
  );

  const items = [...(data?.publications ?? []), ...(extra?.items ?? [])];
  const page = extra?.page ?? 1;
  const hasMore = !!data && page < data.pageCount;

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await fetchFeed(page + 1, filters);
      const seen = new Set(items.map((p) => p.id));
      setMore({
        key,
        items: [...(extra?.items ?? []), ...next.publications.filter((p) => !seen.has(p.id))],
        page: next.page,
      });
    } catch (e: unknown) {
      setMessage(e instanceof ApiError ? e.message : "Chargement impossible.");
    } finally {
      setLoadingMore(false);
    }
  }

  const change = (next: Partial<FeedFilters>) => setFilters((f) => ({ ...f, ...next }));
  const stats = home.data?.stats;
  const destinations = home.data?.destinations ?? [];
  const destination = destinations.find((d) => d.id === filters.circuit);

  const header = (
    <View style={{ gap: 14 }}>
      {user ? (
        <View style={styles.profile}>
          <View style={styles.ring}>
            <Avatar name={`${user.prenom} ${user.nom}`} photo={user.photoUrl} size={54} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.name}>
              {user.prenom} {user.nom.charAt(0)}.
            </Text>
            <View style={styles.statsRow}>
              {[
                [stats?.publications, "Publications"],
                [stats?.jaimes, "J'aime reçus"],
                [stats?.commentaires, "Commentaires"],
              ].map(([n, label]) => (
                <View key={label as string} accessible accessibilityLabel={`${n ?? 0} ${label}`}>
                  <Text style={styles.statN}>{n ?? "–"}</Text>
                  <Text style={styles.statL}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={18} color={theme.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => change({ q: search.trim() || undefined })}
            returnKeyType="search"
            placeholder="Circuit, agence, mot…"
            placeholderTextColor={theme.textMuted}
            style={styles.searchInput}
            accessibilityLabel="Rechercher dans la communauté"
          />
          {filters.q ? (
            <Pressable
              onPress={() => {
                setSearch("");
                change({ q: undefined });
              }}
              accessibilityRole="button"
              accessibilityLabel="Effacer la recherche"
            >
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <Button label="Partager mes photos" onPress={() => router.push("/communaute/nouveau")} />

      {destinations.length ? (
        <View style={{ gap: 8 }}>
          <View style={styles.between}>
            <Text style={styles.h2}>Destinations</Text>
            {filters.circuit ? (
              <Pressable onPress={() => change({ circuit: undefined })} accessibilityRole="button">
                <Text style={styles.link}>Toutes</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12 }}
          >
            {destinations.map((d) => {
              const active = d.id === filters.circuit;
              return (
                <Pressable
                  key={d.id}
                  onPress={() => change({ circuit: active ? undefined : d.id })}
                  style={styles.story}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${d.titre}, ${d.agence}, ${d.publications} publications`}
                >
                  <View style={[styles.storyRing, active && styles.storyRingOn]}>
                    <Image
                      source={imageUrl(d.photo)}
                      style={styles.storyImg}
                      contentFit="cover"
                      accessibilityIgnoresInvertColors
                    />
                  </View>
                  <Text style={[styles.storyText, active && styles.storyTextOn]} numberOfLines={2}>
                    {d.titre}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.between}>
        <Text style={styles.h2} numberOfLines={1}>
          {filters.moi
            ? "Mes publications"
            : destination
              ? destination.titre
              : filters.q
                ? `« ${filters.q} »`
                : "Publications"}
        </Text>
        <Pressable
          onPress={() => change({ moi: !filters.moi || undefined })}
          accessibilityRole="button"
          accessibilityState={{ selected: !!filters.moi }}
        >
          <Text style={styles.link}>{filters.moi ? "Tout le fil" : "Mes publications"}</Text>
        </Pressable>
      </View>
      <Segmented options={TRIS} value={filters.tri} onChange={(tri) => change({ tri })} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader kicker="Voyageurs de toutes les agences" title="Communauté" />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <FlatList
          data={data ? items : []}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          refreshing={loading && !!data}
          onRefresh={() => {
            setMore(null);
            reload();
            home.reload();
          }}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.6}
          ListHeaderComponent={header}
          ListHeaderComponentStyle={{ marginBottom: 14 }}
          ListEmptyComponent={
            !data ? (
              <Loading />
            ) : (
              <Empty
                message={
                  filters.moi
                    ? "Vous n'avez encore rien publié."
                    : "Aucune publication ne correspond."
                }
              />
            )
          }
          ListFooterComponent={
            loadingMore ? (
              <Loading />
            ) : data && items.length && !hasMore ? (
              <Text style={styles.end}>Vous avez tout vu.</Text>
            ) : undefined
          }
          renderItem={({ item }) => (
            <PublicationCard
              p={item}
              onChanged={() => {
                setMore(null);
                reload();
                home.reload();
              }}
              onMessage={setMessage}
              onDestination={(circuit) => change({ circuit })}
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
    profile: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: t.surface,
      borderRadius: radius.lg,
      padding: 14,
    },
    ring: { borderRadius: 32, borderWidth: 2, borderColor: t.accent, padding: 2 },
    name: { fontFamily: fonts.display, fontSize: 18, color: t.text },
    statsRow: { flexDirection: "row", gap: 18 },
    statN: { fontFamily: fonts.display, fontSize: 17, color: t.text },
    statL: { fontFamily: fonts.text, fontSize: 11, color: t.textMuted },
    searchRow: { flexDirection: "row", gap: 10 },
    search: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: 44,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      paddingHorizontal: 14,
    },
    searchInput: {
      flex: 1,
      fontFamily: fonts.text,
      fontSize: 14,
      color: t.text,
      paddingVertical: 10,
    },
    between: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    h2: { flex: 1, fontFamily: fonts.display, fontSize: 20, color: t.text },
    link: { fontFamily: fonts.textSemiBold, fontSize: 13, color: t.accent },
    story: { width: 76, alignItems: "center", gap: 6 },
    storyRing: {
      borderRadius: 40,
      borderWidth: 3,
      borderColor: colors.sand300,
      padding: 2,
    },
    storyRingOn: { borderColor: t.accent },
    storyImg: { width: 62, height: 62, borderRadius: 31, backgroundColor: t.surfaceAlt },
    storyText: {
      fontFamily: fonts.text,
      fontSize: 11,
      lineHeight: 14,
      color: t.text,
      textAlign: "center",
    },
    storyTextOn: { fontFamily: fonts.textSemiBold, color: t.accent },
    message: {
      fontFamily: fonts.textMedium,
      fontSize: 13,
      color: t.accent,
      backgroundColor: t.accentSoft,
      borderRadius: radius.sm,
      padding: 10,
    },
    end: {
      fontFamily: fonts.text,
      fontSize: 13,
      color: t.textMuted,
      textAlign: "center",
      padding: 16,
    },
  }),
);
