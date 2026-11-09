import Ionicons from "@expo/vector-icons/Ionicons";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Link, router } from "expo-router";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { CategoryButton } from "@/components/category-button";
import { CircuitCard } from "@/components/circuit-card";
import { DepartBanner } from "@/components/depart-banner";
import { ErrorState, Loading } from "@/components/states";
import { useAsync } from "@/hooks/use-async";
import { fetchCatalogue, imageUrl } from "@/lib/api";
import { colors, difficultyColors, fonts, radius } from "@/theme/tokens";

/** Photo du haut de l'accueil (créditée sur le site : Mahambo, NalyRATOVO, CC BY-SA 4.0). */
const HERO = "/images/circuits/sentier-mahambo-doany-ambodiforaha.jpg";

/**
 * Accueil de l'application (d'après la maquette fournie par l'étudiant) : accroche, recherche,
 * catégories, circuits populaires (les mieux notés) et prochain départ, pour toutes les
 * agences de la plateforme.
 */
export default function HomeScreen() {
  const tabBarHeight = useBottomTabBarHeight();
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
      refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}
    >
      <View style={styles.hero}>
        <Image source={imageUrl(HERO)} style={styles.heroImage} contentFit="cover" />
        <LinearGradient
          colors={[colors.white, "rgba(255,255,255,0.85)", "rgba(255,255,255,0)"]}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["rgba(255,255,255,0)", colors.white]}
          locations={[0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView edges={["top"]} style={styles.heroContent}>
          <Text style={styles.script}>Explorez Madagascar</Text>
          <Text style={styles.title} accessibilityRole="header">
            Découvrez.{"\n"}Marchez.{"\n"}
            <Text style={styles.titleAccent}>Partagez.</Text>
          </Text>
          <Text style={styles.subtitle}>
            Des randonnées préparées{"\n"}par des agences locales.
          </Text>
        </SafeAreaView>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={20} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un circuit, une région…"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => explore(search.trim() ? { q: search.trim() } : {})}
            accessibilityLabel="Rechercher un circuit"
          />
          <Pressable
            onPress={() => explore(search.trim() ? { q: search.trim() } : {})}
            style={styles.searchButton}
            accessibilityRole="button"
            accessibilityLabel="Lancer la recherche"
          >
            <Ionicons name="search" size={18} color={colors.white} />
          </Pressable>
        </View>
      </View>

      <View style={styles.categories}>
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
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Circuits populaires
        </Text>
        <Link href="/explorer" style={styles.seeAll}>
          Voir tout <Ionicons name="arrow-forward" size={14} color={colors.teal700} />
        </Link>
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
            contentContainerStyle={styles.carousel}
          />
          {prochain ? (
            <View style={styles.bannerWrap}>
              <DepartBanner circuit={prochain} />
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  hero: { height: 330 },
  heroImage: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  heroContent: { paddingHorizontal: 22, paddingTop: 18 },
  script: { fontFamily: fonts.script, fontSize: 26, color: colors.teal600 },
  title: {
    fontFamily: fonts.display,
    fontSize: 38,
    lineHeight: 40,
    color: colors.teal900,
    marginTop: 4,
  },
  titleAccent: { color: colors.teal500 },
  subtitle: {
    fontFamily: fonts.text,
    fontSize: 14,
    lineHeight: 20,
    color: colors.teal900,
    marginTop: 10,
  },
  searchWrap: { paddingHorizontal: 18, marginTop: -6 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    shadowColor: colors.teal900,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.text,
    fontSize: 14,
    color: colors.teal900,
    paddingVertical: 8,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.teal700,
    alignItems: "center",
    justifyContent: "center",
  },
  categories: {
    flexDirection: "row",
    marginHorizontal: 18,
    marginTop: 18,
    paddingVertical: 16,
    paddingHorizontal: 6,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    shadowColor: colors.teal900,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 26,
    marginBottom: 12,
  },
  sectionTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.teal900 },
  seeAll: { fontFamily: fonts.textMedium, fontSize: 13, color: colors.teal700 },
  carousel: { paddingHorizontal: 18, gap: 12 },
  bannerWrap: { paddingHorizontal: 18, marginTop: 22 },
});
