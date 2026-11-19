import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { CategoryButton } from "@/components/category-button";
import { CircuitCard } from "@/components/circuit-card";
import { DepartBanner } from "@/components/depart-banner";
import { Glass, GlassIconButton } from "@/components/glass";
import { ErrorState, Loading } from "@/components/states";
import { useActivity } from "@/context/activity";
import { useAuth } from "@/context/auth";
import { useAsync } from "@/hooks/use-async";
import { fetchCatalogue, imageUrl } from "@/lib/api";
import { makeStyles, useTheme } from "@/theme/theme";
import { colors, difficultyColors, fonts, radius } from "@/theme/tokens";

/** Photo du haut de l'accueil (créditée sur le site : Mahambo, NalyRATOVO, CC BY-SA 4.0). */
const HERO = "/images/circuits/sentier-mahambo-doany-ambodiforaha.jpg";
const HERO_HEIGHT = 470;

/**
 * Accueil (refonte « verre dépoli ») : grande photo, barre en verre (profil, logo, messages,
 * notifications), salutation, recherche et catégories en verre, puis les circuits populaires
 * (les mieux notés) et le prochain départ, pour toutes les agences de la plateforme.
 */
export default function HomeScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { unread } = useActivity();
  const [search, setSearch] = useState("");
  const { data, error, loading, reload } = useAsync(() => fetchCatalogue(), "accueil");

  const populaires = useMemo(
    () =>
      [...(data?.circuits ?? [])]
        .sort((a, b) => (b.note?.moyenne ?? 0) - (a.note?.moyenne ?? 0))
        .slice(0, 6),
    [data],
  );
  // Le catalogue est trié par départ le plus proche : le premier qui en a un.
  const prochain = data?.circuits.find((c) => c.prochainDepart) ?? null;

  const explore = (params: Record<string, string> = {}) =>
    router.push({ pathname: "/explorer", params });
  const initials = `${user?.prenom[0] ?? ""}${user?.nom[0] ?? ""}`.toUpperCase();

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
      refreshControl={
        <RefreshControl refreshing={loading && !!data} onRefresh={reload} tintColor="#fff" />
      }
    >
      <View style={{ height: HERO_HEIGHT }}>
        <Image source={imageUrl(HERO)} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={["rgba(6,26,31,0.55)", "rgba(6,26,31,0.05)", "rgba(6,26,31,0.35)", theme.bg]}
          locations={[0, 0.3, 0.75, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={() => router.push("/compte")}
            accessibilityRole="button"
            accessibilityLabel="Mon compte"
          >
            {user?.photoUrl ? (
              <Avatar name={`${user.prenom} ${user.nom}`} photo={user.photoUrl} size={44} />
            ) : (
              <Glass rounded={22} style={s.avatar}>
                <View style={s.center}>
                  <Text style={s.initials}>{initials}</Text>
                </View>
              </Glass>
            )}
          </Pressable>
          <View style={s.brand} accessible accessibilityLabel="Green Trek">
            <Image
              source={require("../../../assets/images/splash-symbole.png")}
              style={{ width: 34, height: 18 }}
              contentFit="contain"
            />
            <Image
              source={require("../../../assets/images/splash-nom.png")}
              style={{ width: 96, height: 10 }}
              contentFit="contain"
            />
          </View>
          <View style={s.actions}>
            <GlassIconButton
              icon="images-outline"
              label="Communauté"
              onPress={() => router.push("/communaute")}
            />
            <GlassIconButton
              icon="chatbubbles-outline"
              label={`Messages${unread.conversations ? `, ${unread.conversations} non lus` : ""}`}
              count={unread.conversations}
              onPress={() => router.push("/messages")}
            />
            <GlassIconButton
              icon="notifications-outline"
              label={`Notifications${unread.notifications ? `, ${unread.notifications} non lues` : ""}`}
              count={unread.notifications}
              onPress={() => router.push("/notifications")}
            />
          </View>
        </View>
        <View style={s.heroText}>
          <Text style={s.script}>Bonjour {user?.prenom},</Text>
          <Text style={s.title} accessibilityRole="header">
            Où marcherez-vous{"\n"}cette fois ?
          </Text>
        </View>
        <View style={s.searchWrap}>
          <Glass rounded={radius.pill}>
            <View style={s.search}>
              <Ionicons name="search-outline" size={20} color={theme.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Circuit, agence, ville…"
                placeholderTextColor={theme.textMuted}
                style={s.searchInput}
                returnKeyType="search"
                onSubmitEditing={() => explore(search.trim() ? { q: search.trim() } : {})}
                accessibilityLabel="Rechercher un circuit"
              />
              <Pressable
                onPress={() => explore(search.trim() ? { q: search.trim() } : {})}
                style={s.searchButton}
                accessibilityRole="button"
                accessibilityLabel="Lancer la recherche"
              >
                <Ionicons name="arrow-forward" size={18} color={theme.onPrimary} />
              </Pressable>
            </View>
          </Glass>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.categories}
      >
        <CategoryButton
          label="Facile"
          icon="walk"
          color={difficultyColors.FACILE}
          onPress={() => explore({ difficulte: "FACILE" })}
        />
        <CategoryButton
          label="Moyenne"
          icon="trail-sign"
          color={difficultyColors.MOYENNE}
          onPress={() => explore({ difficulte: "MOYENNE" })}
        />
        <CategoryButton
          label="Difficile"
          icon="triangle"
          color={difficultyColors.DIFFICILE}
          onPress={() => explore({ difficulte: "DIFFICILE" })}
        />
        <CategoryButton
          label="Ce mois-ci"
          icon="calendar"
          color={difficultyColors.PROCHE}
          onPress={() => explore({ proches: "1" })}
        />
      </ScrollView>

      <View style={s.sectionHead}>
        <Text style={s.sectionTitle} accessibilityRole="header">
          Circuits populaires
        </Text>
        <Pressable onPress={() => explore()} accessibilityRole="link" style={s.seeAll}>
          <Text style={s.seeAllText}>Voir tout</Text>
          <Ionicons name="chevron-forward" size={14} color={theme.accent} />
        </Pressable>
      </View>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Loading label="Chargement des circuits…" />
      ) : (
        <>
          <FlatList
            horizontal
            data={populaires}
            keyExtractor={(c) => `${c.agence.slug}/${c.slug}`}
            renderItem={({ item }) => <CircuitCard circuit={item} />}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.carousel}
            snapToInterval={242}
            decelerationRate="fast"
          />
          {prochain ? (
            <View style={s.bannerWrap}>
              <DepartBanner circuit={prochain} />
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 18,
    },
    avatar: { width: 44, height: 44 },
    initials: { fontFamily: fonts.textSemiBold, fontSize: 15, color: t.text },
    brand: { alignItems: "center", gap: 4 },
    actions: { flexDirection: "row", gap: 8 },
    heroText: { position: "absolute", left: 22, right: 22, bottom: 104 },
    script: { fontFamily: fonts.script, fontSize: 26, color: colors.sand300 },
    title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: colors.white },
    searchWrap: { position: "absolute", left: 18, right: 18, bottom: 28 },
    search: { flexDirection: "row", alignItems: "center", gap: 10, padding: 6, paddingLeft: 18 },
    searchInput: {
      flex: 1,
      fontFamily: fonts.text,
      fontSize: 15,
      color: t.text,
      paddingVertical: 8,
    },
    searchButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    categories: { gap: 8, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 6 },
    sectionHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      marginTop: 22,
      marginBottom: 12,
    },
    sectionTitle: { fontFamily: fonts.display, fontSize: 22, color: t.text },
    seeAll: { flexDirection: "row", alignItems: "center", gap: 2 },
    seeAllText: { fontFamily: fonts.textMedium, fontSize: 14, color: t.accent },
    carousel: { paddingHorizontal: 18, gap: 12 },
    bannerWrap: { paddingHorizontal: 18, marginTop: 22 },
  }),
);
