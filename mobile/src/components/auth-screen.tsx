import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles } from "@/theme/theme";
import { colors, fonts, radius } from "@/theme/tokens";

import { Glass, GlassIconButton, Segmented } from "./glass";

/** Photo embarquée (pas de serveur avant la connexion) : plage de Mahambo, créditée. */
const PHOTO = require("../../assets/images/connexion-mahambo.jpg");

/**
 * Porte d'entrée de l'application (après l'écran d'ouverture) : photo plein écran, logo, puis
 * une carte en verre avec « Connexion / Créer un compte » et le formulaire. La roue dentée
 * ouvre « Adresse du serveur » (indispensable à l'APK avant la première connexion).
 */
export function AuthScreen({
  active,
  title,
  subtitle,
  onSwitch,
  children,
}: {
  active: "connexion" | "inscription";
  title: string;
  subtitle: string;
  onSwitch: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  return (
    <View style={s.screen}>
      <Image source={PHOTO} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(6,26,31,0.55)", "rgba(6,26,31,0.10)", "rgba(6,26,31,0.75)"]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={[
          s.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.top}>
          <View style={{ width: 44 }} />
          <View style={s.brand} accessible accessibilityLabel="Green Trek">
            <Image
              source={require("../../assets/images/splash-symbole.png")}
              style={{ width: 64, height: 35 }}
              contentFit="contain"
            />
            <Image
              source={require("../../assets/images/splash-nom.png")}
              style={{ width: 120, height: 12 }}
              contentFit="contain"
            />
          </View>
          <GlassIconButton
            icon="settings-outline"
            label="Adresse du serveur"
            onPress={() => router.push("/serveur")}
          />
        </View>
        <View style={s.hero}>
          <Text style={s.script}>Explorez Madagascar</Text>
          <Text style={s.claim}>Randonnées et{"\n"}villages, à pied.</Text>
        </View>
        <Glass strong rounded={radius.xl} style={s.card}>
          <View style={s.cardBody}>
            <Segmented
              options={[
                { key: "connexion", label: "Connexion" },
                { key: "inscription", label: "Créer un compte" },
              ]}
              value={active}
              onChange={(k) => (k === active ? undefined : onSwitch())}
            />
            <Text style={s.title} accessibilityRole="header">
              {title}
            </Text>
            <Text style={s.subtitle}>{subtitle}</Text>
            <View style={s.form}>{children}</View>
          </View>
        </Glass>
        <Text style={s.credit}>Photo : plage de Mahambo, NalyRATOVO, CC BY-SA 4.0</Text>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.teal900 },
    content: { flexGrow: 1, paddingHorizontal: 16, gap: 16 },
    top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    brand: { alignItems: "center", gap: 6 },
    hero: { flex: 1, justifyContent: "flex-end", paddingHorizontal: 8, minHeight: 120 },
    script: { fontFamily: fonts.script, fontSize: 26, color: colors.sand300 },
    claim: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, color: colors.white },
    card: {},
    cardBody: { padding: 18, gap: 4 },
    title: { fontFamily: fonts.display, fontSize: 24, color: t.text, marginTop: 16 },
    subtitle: { fontFamily: fonts.text, fontSize: 13, lineHeight: 19, color: t.textMuted },
    form: { gap: 14, marginTop: 14 },
    credit: {
      fontFamily: fonts.text,
      fontSize: 10,
      color: "rgba(255,255,255,0.8)",
      textAlign: "center",
    },
  }),
);
