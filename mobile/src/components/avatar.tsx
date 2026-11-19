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
}: {
  name: string;
  photo?: string | null;
  size?: number;
}) {
  const { theme } = useTheme();
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

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  text: { fontFamily: fonts.display },
});
