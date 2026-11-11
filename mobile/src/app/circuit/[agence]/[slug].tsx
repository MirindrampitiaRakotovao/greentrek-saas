import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CircuitMap } from "@/components/circuit-map";
import { FavoriteButton } from "@/components/favorite-button";
import { Stars } from "@/components/stars";
import { ErrorState, Loading } from "@/components/states";
import { useAsync } from "@/hooks/use-async";
import { type CircuitDetail, fetchCircuit, imageUrl } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { confirmAction } from "@/lib/confirm";
import {
  DIFFICULTE_LABELS,
  formatDayRange,
  formatDuree,
  formatMoney,
  formatPlaces,
} from "@/lib/format";
import { colors, fonts, radius } from "@/theme/tokens";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Étapes regroupées par jour (« Jour 1 »…), comme sur le site. */
function parJour(etapes: CircuitDetail["etapes"]) {
  const groups: { jour: number | null; etapes: CircuitDetail["etapes"] }[] = [];
  for (const e of etapes) {
    const last = groups.at(-1);
    if (last && last.jour === e.jour) last.etapes.push(e);
    else groups.push({ jour: e.jour, etapes: [e] });
  }
  return groups;
}

/**
 * Fiche d'un circuit : photo, titre, agence, note, infos clés, description, itinéraire par
 * jour, départs, prestations des partenaires et avis publiés.
 * « Réserver » ouvre la réservation dans l'application ; sans compte de l'agence du circuit,
 * la connexion est proposée d'abord (un compte voyageur est propre à une agence).
 */
export default function CircuitScreen() {
  const { agence, slug } = useLocalSearchParams<{ agence: string; slug: string }>();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const {
    data: c,
    error,
    reload,
  } = useAsync(() => fetchCircuit(agence, slug), `${agence}/${slug}`);

  const back = (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      style={[styles.back, { top: insets.top + 8 }]}
      accessibilityRole="button"
      accessibilityLabel="Retour"
    >
      <Ionicons name="chevron-back" size={22} color={colors.teal900} />
    </Pressable>
  );

  if (error)
    return (
      <View style={[styles.center, { paddingTop: insets.top + 60 }]}>
        {back}
        <ErrorState message={error} onRetry={reload} />
      </View>
    );
  if (!c)
    return (
      <View style={[styles.center, { paddingTop: insets.top + 60 }]}>
        {back}
        <Loading />
      </View>
    );

  const uri = imageUrl(c.image);
  const facts: { icon: IconName; label: string }[] = [
    { icon: "time-outline", label: formatDuree(c.dureeJours) },
    { icon: "trending-up-outline", label: DIFFICULTE_LABELS[c.difficulte] ?? c.difficulte },
    ...(c.distanceKm !== null
      ? [{ icon: "map-outline" as const, label: `${c.distanceKm.toFixed(1).replace(".", ",")} km` }]
      : []),
    { icon: "people-outline", label: `${c.capaciteMax} pers. max.` },
  ];
  async function reserver(departId: string) {
    const booking = {
      pathname: "/reserver/[depart]" as const,
      params: { depart: departId, agence: c!.agence.slug, circuit: c!.slug },
    };
    const retour = `/reserver/${departId}?agence=${c!.agence.slug}&circuit=${c!.slug}`;
    if (user && user.agenceSlug === c!.agence.slug) return router.push(booking);
    if (user) {
      const ok = await confirmAction({
        title: "Changer de compte ?",
        message: `Ce circuit est proposé par ${c!.agence.nom}. Votre compte est chez ${user.agenceNom} : connectez-vous avec un compte ${c!.agence.nom}.`,
        confirmLabel: "Changer de compte",
      });
      if (!ok) return;
      await logout();
    }
    router.push({ pathname: "/connexion", params: { agence: c!.agence.slug, retour } });
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={styles.hero}>
          {uri ? (
            <Image
              source={uri}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={300}
            />
          ) : null}
          <LinearGradient
            colors={["rgba(0,0,0,0.35)", "transparent", "rgba(15,65,77,0.95)"]}
            locations={[0, 0.35, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heart, { top: insets.top + 8 }]}>
            <FavoriteButton agence={c.agence.slug} circuit={c.slug} titre={c.titre} size={40} />
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.agence}>{c.agence.nom}</Text>
            <Text style={styles.title} accessibilityRole="header">
              {c.titre}
            </Text>
            {c.note ? <Stars note={c.note} light /> : null}
            {c.credit ? <Text style={styles.credit}>{c.credit}</Text> : null}
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.facts}>
            {facts.map((f) => (
              <View key={f.label} style={styles.fact}>
                <Ionicons name={f.icon} size={15} color={colors.teal700} />
                <Text style={styles.factText}>{f.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>à partir de</Text>
            <Text style={styles.price}>
              {formatMoney(c.prixMin, c.agence.devise)}
              <Text style={styles.priceUnit}> / pers.</Text>
            </Text>
          </View>

          {c.resume ? <Text style={styles.lead}>{c.resume}</Text> : null}
          {c.description ? <Text style={styles.paragraph}>{c.description}</Text> : null}

          <Text style={styles.h2} accessibilityRole="header">
            Prochains départs
          </Text>
          {c.departs.length === 0 ? (
            <Text style={styles.paragraph}>
              Aucun départ ouvert pour l’instant. Contactez l’agence pour un départ sur mesure.
            </Text>
          ) : (
            c.departs.map((d) => (
              <View key={d.id} style={styles.depart}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.departDate}>{formatDayRange(d.dateDebut, d.dateFin)}</Text>
                  <Text style={styles.departMeta}>
                    {formatPlaces(d.placesLibres)} · {formatMoney(d.prix, c.agence.devise)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void reserver(d.id)}
                  style={styles.reserve}
                  accessibilityRole="button"
                  accessibilityLabel={`Réserver le départ du ${formatDayRange(d.dateDebut, d.dateFin)}`}
                >
                  <Text style={styles.reserveText}>Réserver</Text>
                </Pressable>
              </View>
            ))
          )}

          <Text style={styles.h2} accessibilityRole="header">
            Itinéraire
          </Text>
          <CircuitMap steps={c.etapes} trace={c.trace} />
          {parJour(c.etapes).map((g, i) => (
            <View key={`${g.jour ?? "x"}-${i}`} style={styles.day}>
              {g.jour !== null ? <Text style={styles.dayTitle}>Jour {g.jour}</Text> : null}
              {g.etapes.map((e) => (
                <View key={e.ordre} style={styles.step}>
                  <View style={styles.stepDot}>
                    <Text style={styles.stepNum}>{e.ordre}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepName}>{e.nom}</Text>
                    {e.description ? (
                      <Text style={styles.stepText} numberOfLines={2}>
                        {e.description}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ))}

          {c.partenaires.length > 0 ? (
            <>
              <Text style={styles.h2} accessibilityRole="header">
                Avec les partenaires locaux
              </Text>
              {c.partenaires.map((p) => (
                <View key={`${p.partenaire}-${p.prestation}`} style={styles.partner}>
                  <Text style={styles.stepName}>{p.prestation}</Text>
                  <Text style={styles.stepText}>
                    {p.partenaire} · {p.inclusDansPrix ? "inclus dans le prix" : "en option"}
                  </Text>
                </View>
              ))}
            </>
          ) : null}

          {c.avis.length > 0 ? (
            <>
              <Text style={styles.h2} accessibilityRole="header">
                Ils ont fait ce circuit
              </Text>
              {c.avis.map((a, i) => (
                <View key={i} style={styles.review}>
                  <Stars note={{ moyenne: a.note, nombre: 1 }} />
                  {a.commentaire ? <Text style={styles.paragraph}>« {a.commentaire} »</Text> : null}
                  <Text style={styles.reviewAuthor}>{a.auteur}</Text>
                </View>
              ))}
            </>
          ) : null}
        </View>
      </ScrollView>
      {back}
    </View>
  );
}

const card = {
  backgroundColor: colors.white,
  borderRadius: radius.md,
  padding: 14,
  shadowColor: colors.teal900,
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  center: { flex: 1, backgroundColor: colors.canvas },
  back: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  hero: { height: 340, backgroundColor: colors.teal900, justifyContent: "flex-end" },
  heart: { position: "absolute", right: 16, zIndex: 1 },
  heroBody: { padding: 20, gap: 6 },
  agence: { fontFamily: fonts.script, fontSize: 22, color: colors.sand300 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, color: colors.white },
  credit: { fontFamily: fonts.text, fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 4 },
  content: { padding: 18, gap: 12 },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  factText: { fontFamily: fonts.textMedium, fontSize: 12, color: colors.teal900 },
  priceCard: { ...card, flexDirection: "row", alignItems: "baseline", gap: 8 },
  priceLabel: { fontFamily: fonts.text, fontSize: 13, color: colors.muted },
  price: { fontFamily: fonts.display, fontSize: 24, color: colors.teal900 },
  priceUnit: { fontFamily: fonts.text, fontSize: 13, color: colors.muted },
  lead: { fontFamily: fonts.textMedium, fontSize: 15, lineHeight: 22, color: colors.teal900 },
  paragraph: { fontFamily: fonts.text, fontSize: 14, lineHeight: 21, color: colors.muted },
  h2: { fontFamily: fonts.display, fontSize: 20, color: colors.teal900, marginTop: 10 },
  depart: { ...card, flexDirection: "row", alignItems: "center", gap: 10 },
  departDate: { fontFamily: fonts.textSemiBold, fontSize: 15, color: colors.teal900 },
  departMeta: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  reserve: {
    backgroundColor: colors.teal700,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  reserveText: { fontFamily: fonts.textSemiBold, fontSize: 14, color: colors.white },
  day: { gap: 8 },
  dayTitle: { fontFamily: fonts.script, fontSize: 22, color: colors.teal700 },
  step: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.teal700,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepNum: { fontFamily: fonts.textSemiBold, fontSize: 11, color: colors.white },
  stepName: { fontFamily: fonts.textSemiBold, fontSize: 14, color: colors.teal900 },
  stepText: { fontFamily: fonts.text, fontSize: 12, lineHeight: 17, color: colors.muted },
  partner: { ...card, gap: 2 },
  review: { ...card, gap: 6 },
  reviewAuthor: { fontFamily: fonts.textMedium, fontSize: 12, color: colors.teal700 },
});
