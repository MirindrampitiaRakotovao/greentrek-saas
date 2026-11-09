import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type CircuitResume, imageUrl } from "@/lib/api";
import { formatDayRange, formatPlaces } from "@/lib/format";
import { colors, fonts, radius } from "@/theme/tokens";

/** Bannière « Prochain départ » (bannière promotionnelle de la maquette). */
export function DepartBanner({ circuit }: { circuit: CircuitResume }) {
  const depart = circuit.prochainDepart;
  if (!depart) return null;
  const uri = imageUrl(circuit.image);
  const open = () =>
    router.push({
      pathname: "/circuit/[agence]/[slug]",
      params: { agence: circuit.agence.slug, slug: circuit.slug },
    });
  return (
    <View style={styles.banner}>
      {uri ? <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <LinearGradient
        colors={[colors.teal900, "rgba(15, 65, 77, 0.85)", "rgba(15, 65, 77, 0.15)"]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.body}>
        <Text style={styles.kicker}>Prochain départ</Text>
        <Text style={styles.title} numberOfLines={2}>
          {circuit.titre}
        </Text>
        <Text style={styles.meta}>
          {formatDayRange(depart.dateDebut, depart.dateFin)} · {formatPlaces(depart.placesLibres)}
        </Text>
        <Pressable onPress={open} style={styles.button} accessibilityRole="button">
          <Text style={styles.buttonText}>Réserver</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.teal900} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.teal900,
    minHeight: 168,
  },
  body: { padding: 18, gap: 4, maxWidth: "68%" },
  kicker: { fontFamily: fonts.script, fontSize: 22, color: colors.sand300 },
  title: { fontFamily: fonts.display, fontSize: 19, lineHeight: 22, color: colors.white },
  meta: { fontFamily: fonts.text, fontSize: 12, color: "rgba(255,255,255,0.9)" },
  button: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  buttonText: { fontFamily: fonts.textSemiBold, fontSize: 14, color: colors.teal900 },
});
