import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router } from "expo-router";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, radius } from "@/theme/tokens";

/**
 * Mise en page des écrans de connexion et d'inscription (d'après le style des pages de connexion
 * du site) : logo, onglets Connexion / Créer un compte, titre, formulaire.
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
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        >
          <Ionicons name="close" size={22} color={colors.teal900} />
        </Pressable>
        <View style={styles.brand}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.tagline}>EXPLORER · RÉSERVER · PARTAGER</Text>
        </View>
        <View style={styles.tabs} accessibilityRole="tablist">
          {(["connexion", "inscription"] as const).map((tab) => {
            const on = tab === active;
            return (
              <Pressable
                key={tab}
                onPress={on ? undefined : onSwitch}
                style={[styles.tab, on ? styles.tabOn : styles.tabOff]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.tabText, on && styles.tabTextOn]}>
                  {tab === "connexion" ? "Connexion" : "Créer un compte"}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.form}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: 22 },
  close: {
    alignSelf: "flex-end",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.teal50,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { alignItems: "center", gap: 8 },
  logo: { width: 96, height: 96 },
  tagline: { fontFamily: fonts.text, fontSize: 11, letterSpacing: 2.5, color: colors.muted },
  tabs: { flexDirection: "row", gap: 10, marginTop: 24 },
  tab: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.sm + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  tabOn: { backgroundColor: colors.teal900 },
  tabOff: { borderWidth: 1.5, borderColor: colors.teal900 },
  tabText: { fontFamily: fonts.textSemiBold, fontSize: 14, color: colors.teal900 },
  tabTextOn: { color: colors.white },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.teal900, marginTop: 26 },
  subtitle: {
    fontFamily: fonts.text,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    marginTop: 4,
  },
  form: { gap: 16, marginTop: 20 },
});
