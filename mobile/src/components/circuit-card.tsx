import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type CircuitResume, imageUrl } from "@/lib/api";
import { formatDuree, formatMoney } from "@/lib/format";
import { makeStyles } from "@/theme/theme";
import { colors, fonts, radius } from "@/theme/tokens";

import { FavoriteButton } from "./favorite-button";
import { Glass } from "./glass";
import { Stars } from "./stars";

/**
 * Carte photo d'un circuit (carrousel de l'accueil) : grande photo, cœur en verre, et panneau
 * en verre posé en bas avec le titre, l'agence, la note, la durée et le prix « à partir de ».
 */
export function CircuitCard({ circuit, width = 230 }: { circuit: CircuitResume; width?: number }) {
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
        style={({ pressed }) => [
          styles.card,
          { width, transform: [{ scale: pressed ? 0.98 : 1 }] },
        ]}
        accessibilityRole="link"
        accessibilityLabel={`${circuit.titre}, ${circuit.agence.nom}, à partir de ${formatMoney(circuit.prixMin, circuit.agence.devise)} par personne`}
      >
        {uri ? (
          <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.teal700 }]} />
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0.25)", "transparent"]}
          locations={[0, 0.3]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.top}>
          {circuit.note ? (
            <Glass rounded={radius.pill}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 5 }}>
                <Stars note={circuit.note} />
              </View>
            </Glass>
          ) : (
            <View />
          )}
          <FavoriteButton
            agence={circuit.agence.slug}
            circuit={circuit.slug}
            titre={circuit.titre}
          />
        </View>
        <Glass strong rounded={radius.md}>
          <View style={styles.panelBody}>
            <PanelContent circuit={circuit} />
          </View>
        </Glass>
      </Pressable>
    </Link>
  );
}

function PanelContent({ circuit }: { circuit: CircuitResume }) {
  const s = usePanelStyles();
  return (
    <>
      <Text style={s.title} numberOfLines={2}>
        {circuit.titre}
      </Text>
      <Text style={s.agence} numberOfLines={1}>
        {circuit.agence.nom}
      </Text>
      <View style={s.footer}>
        <View style={s.fact}>
          <Ionicons name="time-outline" size={13} color={s.icon.color} />
          <Text style={s.factText}>{formatDuree(circuit.dureeJours)}</Text>
        </View>
        <Text style={s.price}>
          {formatMoney(circuit.prixMin, circuit.agence.devise)}
          <Text style={s.unit}> /pers.</Text>
        </Text>
      </View>
    </>
  );
}

const usePanelStyles = makeStyles((t) =>
  StyleSheet.create({
    title: { fontFamily: fonts.display, fontSize: 16, lineHeight: 19, color: t.text },
    agence: { fontFamily: fonts.text, fontSize: 12, color: t.textMuted, marginTop: 2 },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 8,
    },
    fact: { flexDirection: "row", alignItems: "center", gap: 4 },
    factText: { fontFamily: fonts.text, fontSize: 12, color: t.textMuted },
    icon: { color: t.accent },
    price: { fontFamily: fonts.textSemiBold, fontSize: 14, color: t.text },
    unit: { fontFamily: fonts.text, fontSize: 11, color: t.textMuted },
  }),
);

const styles = StyleSheet.create({
  card: {
    height: 300,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.teal700,
    justifyContent: "space-between",
    padding: 10,
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  panelBody: { padding: 12 },
});
