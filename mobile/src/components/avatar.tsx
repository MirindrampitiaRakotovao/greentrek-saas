import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { imageUrl } from "@/lib/api";
import { useTheme } from "@/theme/theme";
import { fonts } from "@/theme/tokens";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

/** Photo de profil ronde (chemin du site), sinon les initiales sur l'accent du thème. */
export function Avatar({
  name,
  photo,
  size = 40,
  online,
}: {
  name: string;
  photo?: string | null;
  size?: number;
  /** Pastille verte « en ligne » (présence d'un voyageur ou de l'agence). */
  online?: boolean;
}) {
  const { theme } = useTheme();
  if (online) {
    const dot = Math.max(10, Math.round(size * 0.28));
    return (
      <View style={{ width: size, height: size }} accessibilityLabel={`${name}, en ligne`}>
        <Avatar name={name} photo={photo} size={size} />
        <OnlineDot size={dot} />
      </View>
    );
  }
  const uri = imageUrl(photo ?? null);
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <Image
        source={uri}
        style={[box, { backgroundColor: theme.surfaceAlt }]}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[box, styles.center, { backgroundColor: theme.primary }]}>
      <Text style={[styles.text, { color: theme.onPrimary, fontSize: size * 0.38 }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

function OnlineDot({ size }: { size: number }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        position: "absolute",
        right: 0,
        bottom: 0,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: ONLINE,
        borderWidth: 2,
        borderColor: theme.surface,
      }}
    />
  );
}

/** Vert de présence (même sens que sur le site), toujours accompagné du texte « en ligne ». */
const ONLINE = "#12B76A";

/** Texte de présence : « en ligne », « vu il y a … » ou null. */
export function presenceLabel(p: { enLigne: boolean; vu: string | null } | null | undefined) {
  if (!p) return null;
  return p.enLigne ? "en ligne" : p.vu;
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  text: { fontFamily: fonts.display },
});
