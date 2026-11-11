import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type CircuitResume, imageUrl } from "@/lib/api";
import { DIFFICULTE_LABELS, formatDayRange, formatDuree, formatMoney } from "@/lib/format";
import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

import { FavoriteButton } from "./favorite-button";
import { Stars } from "./stars";

/** Ligne de la liste « Explorer » : vignette, titre, agence, durée, difficulté, prix, départ. */
export function CircuitRow({ circuit }: { circuit: CircuitResume }) {
  const s = useStyles();
  const { theme } = useTheme();
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
      <Pressable
        style={({ pressed }) => [s.row, pressed && { opacity: 0.9 }]}
        accessibilityRole="link"
      >
        <View>
          {uri ? (
            <Image source={uri} style={s.thumb} contentFit="cover" transition={200} />
          ) : (
            <View style={[s.thumb, { backgroundColor: theme.surfaceAlt }]} />
          )}
          <View style={s.heart}>
            <FavoriteButton
              agence={circuit.agence.slug}
              circuit={circuit.slug}
              titre={circuit.titre}
              size={30}
            />
          </View>
        </View>
        <View style={s.body}>
          <Text style={s.agence} numberOfLines={1}>
            {circuit.agence.nom}
          </Text>
          <Text style={s.title} numberOfLines={2}>
            {circuit.titre}
          </Text>
          <View style={s.facts}>
            <Ionicons name="time-outline" size={13} color={theme.accent} />
            <Text style={s.fact}>{formatDuree(circuit.dureeJours)}</Text>
            <Ionicons name="trending-up-outline" size={13} color={theme.accent} />
            <Text style={s.fact}>{DIFFICULTE_LABELS[circuit.difficulte]}</Text>
          </View>
          {circuit.note ? <Stars note={circuit.note} /> : null}
          <View style={s.footer}>
            <Text style={s.price}>
              {formatMoney(circuit.prixMin, circuit.agence.devise)}
              <Text style={s.unit}> /pers.</Text>
            </Text>
            {depart ? (
              <Text style={s.depart} numberOfLines={1}>
                {formatDayRange(depart.dateDebut, depart.dateFin)}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: 14,
      padding: 10,
      backgroundColor: t.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
    },
    thumb: { width: 104, height: 124, borderRadius: radius.sm + 2 },
    heart: { position: "absolute", top: 6, left: 6 },
    body: { flex: 1, gap: 3, paddingVertical: 2 },
    agence: { fontFamily: fonts.textMedium, fontSize: 11, color: t.accent },
    title: { fontFamily: fonts.display, fontSize: 15, lineHeight: 18, color: t.text },
    facts: { flexDirection: "row", alignItems: "center", gap: 4 },
    fact: { fontFamily: fonts.text, fontSize: 12, color: t.textMuted, marginRight: 6 },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      gap: 6,
      marginTop: "auto",
    },
    price: { fontFamily: fonts.textSemiBold, fontSize: 14, color: t.text },
    unit: { fontFamily: fonts.text, fontSize: 11, color: t.textMuted },
    depart: { fontFamily: fonts.text, fontSize: 11, color: t.textMuted, flexShrink: 1 },
  }),
);
