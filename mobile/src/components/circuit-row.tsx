import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type CircuitResume, imageUrl } from "@/lib/api";
import { DIFFICULTE_LABELS, formatDayRange, formatDuree, formatMoney } from "@/lib/format";
import { colors, fonts, radius } from "@/theme/tokens";

import { FavoriteButton } from "./favorite-button";
import { Stars } from "./stars";

/** Ligne de la liste « Explorer » : vignette, titre, agence, durée, difficulté, prix, départ. */
export function CircuitRow({ circuit }: { circuit: CircuitResume }) {
  const uri = imageUrl(circuit.image);
  const depart = circuit.prochainDepart;
  return (
    <Link
      href={{
        pathname: "/circuit/[agence]/[slug]",
        params: { agence: circuit.agence.slug, slug: circuit.slug },
      }}
      asChild
    >
      <Pressable style={styles.row} accessibilityRole="link">
        {uri ? (
          <Image source={uri} style={styles.thumb} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.thumb, { backgroundColor: colors.teal100 }]} />
        )}
        <View style={styles.heart}>
          <FavoriteButton
            agence={circuit.agence.slug}
            circuit={circuit.slug}
            titre={circuit.titre}
            size={30}
          />
        </View>
        <View style={styles.body}>
          <Text style={styles.agence} numberOfLines={1}>
            {circuit.agence.nom}
          </Text>
          <Text style={styles.title} numberOfLines={2}>
            {circuit.titre}
          </Text>
          <View style={styles.facts}>
            <Ionicons name="time-outline" size={13} color={colors.teal600} />
            <Text style={styles.fact}>{formatDuree(circuit.dureeJours)}</Text>
            <Ionicons name="trending-up-outline" size={13} color={colors.teal600} />
            <Text style={styles.fact}>{DIFFICULTE_LABELS[circuit.difficulte]}</Text>
          </View>
          {circuit.note ? <Stars note={circuit.note} /> : null}
          <View style={styles.footer}>
            <Text style={styles.price}>
              {formatMoney(circuit.prixMin, circuit.agence.devise)}
              <Text style={styles.unit}> / pers.</Text>
            </Text>
            {depart ? (
              <Text style={styles.depart} numberOfLines={1}>
                {formatDayRange(depart.dateDebut, depart.dateFin)}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    padding: 10,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    shadowColor: colors.teal900,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  thumb: { width: 96, height: 112, borderRadius: radius.sm + 2 },
  heart: { position: "absolute", top: 14, left: 14, zIndex: 1 },
  body: { flex: 1, gap: 3 },
  agence: { fontFamily: fonts.textMedium, fontSize: 11, color: colors.teal600 },
  title: { fontFamily: fonts.display, fontSize: 15, lineHeight: 18, color: colors.teal900 },
  facts: { flexDirection: "row", alignItems: "center", gap: 4 },
  fact: { fontFamily: fonts.text, fontSize: 12, color: colors.muted, marginRight: 6 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 6 },
  price: { fontFamily: fonts.textSemiBold, fontSize: 14, color: colors.teal900 },
  unit: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
  depart: { fontFamily: fonts.text, fontSize: 11, color: colors.muted, flexShrink: 1 },
});
