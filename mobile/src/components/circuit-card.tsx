import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type CircuitResume, imageUrl } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { colors, fonts, radius } from "@/theme/tokens";

import { FavoriteButton } from "./favorite-button";
import { Stars } from "./stars";

/**
 * Carte photo d'un circuit (« Destinations populaires » de la maquette) : photo, voile sombre,
 * titre, agence, note et prix « à partir de ».
 */
export function CircuitCard({ circuit, width = 168 }: { circuit: CircuitResume; width?: number }) {
  const uri = imageUrl(circuit.image);
  return (
    <Link
      href={{
        pathname: "/circuit/[agence]/[slug]",
        params: { agence: circuit.agence.slug, slug: circuit.slug },
      }}
      asChild
    >
      <Pressable
        style={StyleSheet.flatten([styles.card, { width }])}
        accessibilityRole="link"
        accessibilityLabel={`${circuit.titre}, ${circuit.agence.nom}, à partir de ${formatMoney(circuit.prixMin, circuit.agence.devise)} par personne`}
      >
        {uri ? (
          <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.teal700 }]} />
        )}
        <LinearGradient
          colors={["transparent", "rgba(15, 65, 77, 0.92)"]}
          locations={[0.35, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heart}>
          <FavoriteButton
            agence={circuit.agence.slug}
            circuit={circuit.slug}
            titre={circuit.titre}
            size={32}
          />
        </View>
        <View style={styles.body}>
          {circuit.note ? <Stars note={circuit.note} light /> : null}
          <Text style={styles.title} numberOfLines={2}>
            {circuit.titre}
          </Text>
          <Text style={styles.agence} numberOfLines={1}>
            {circuit.agence.nom}
          </Text>
          <Text style={styles.price}>{formatMoney(circuit.prixMin, circuit.agence.devise)}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 220,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.teal700,
  },
  heart: { position: "absolute", top: 10, right: 10, zIndex: 1 },
  body: { flex: 1, justifyContent: "flex-end", padding: 12, gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 16, lineHeight: 19, color: colors.white },
  agence: { fontFamily: fonts.text, fontSize: 12, color: "rgba(255,255,255,0.88)" },
  price: { fontFamily: fonts.textSemiBold, fontSize: 15, color: colors.white, marginTop: 4 },
});
