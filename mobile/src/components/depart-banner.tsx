import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type CircuitResume, imageUrl } from "@/lib/api";
import { formatDayRange, formatDuree, formatPlaces } from "@/lib/format";
import { makeStyles, useTheme } from "@/theme/theme";
import { colors, fonts, radius } from "@/theme/tokens";

import { Glass } from "./glass";

/**
 * « Prochain départ » : grande photo et panneau en verre avec trois repères (dates, places,
 * durée), d'après le bloc central de la maquette, et un bouton rond vers la fiche.
 */
export function DepartBanner({ circuit }: { circuit: CircuitResume }) {
  const s = useStyles();
  const { theme } = useTheme();
  const depart = circuit.prochainDepart;
  if (!depart) return null;
  const uri = imageUrl(circuit.image);
  const open = () =>
    router.push({
      pathname: "/circuit/[agence]/[slug]",
      params: { agence: circuit.agence.slug, slug: circuit.slug },
    });
  return (
    <Pressable onPress={open} style={s.banner} accessibilityRole="link">
      {uri ? <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <LinearGradient
        colors={["rgba(6,26,31,0.6)", "transparent"]}
        locations={[0, 0.5]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.head}>
        <Text style={s.kicker}>Prochain départ</Text>
        <Text style={s.title} numberOfLines={2}>
          {circuit.titre}
        </Text>
      </View>
      <Glass strong rounded={radius.pill} style={s.panel}>
        <View style={s.row}>
          <Stat icon="calendar-outline" value={formatDayRange(depart.dateDebut, depart.dateFin)} />
          <View style={s.sep} />
          <Stat icon="people-outline" value={formatPlaces(depart.placesLibres)} />
          <View style={s.sep} />
          <Stat icon="time-outline" value={formatDuree(circuit.dureeJours)} />
          <View style={s.go}>
            <Ionicons name="arrow-forward" size={18} color={theme.onPrimary} />
          </View>
        </View>
      </Glass>
    </Pressable>
  );
}

function Stat({
  icon,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  value: string;
}) {
  const s = useStyles();
  const { theme } = useTheme();
  return (
    <View style={s.stat}>
      <Ionicons name={icon} size={15} color={theme.accent} />
      <Text style={s.statText} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    banner: {
      height: 230,
      borderRadius: radius.lg,
      overflow: "hidden",
      backgroundColor: colors.teal900,
      justifyContent: "space-between",
      padding: 10,
    },
    head: { padding: 8, gap: 2 },
    kicker: { fontFamily: fonts.script, fontSize: 22, color: colors.sand300 },
    title: { fontFamily: fonts.display, fontSize: 20, lineHeight: 23, color: colors.white },
    panel: {},
    row: { flexDirection: "row", alignItems: "center", padding: 6, paddingLeft: 14 },
    stat: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 4 },
    statText: {
      fontFamily: fonts.textMedium,
      fontSize: 11,
      color: t.text,
      textAlign: "center",
    },
    sep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: t.border },
    go: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.primary,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 6,
    },
  }),
);
