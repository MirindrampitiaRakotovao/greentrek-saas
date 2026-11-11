import { DancingScript_700Bold } from "@expo-google-fonts/dancing-script";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from "@expo-google-fonts/poppins";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { AuthProvider } from "@/context/auth";
import { colors } from "@/theme/tokens";

SplashScreen.preventAutoHideAsync();

/**
 * Racine de l'application Green Trek (voyageurs) : polices du site (Nohemi, Poppins, Dancing
 * Script), puis une pile de navigation : les onglets, et la fiche d'un circuit par-dessus.
 */
export default function RootLayout() {
  const [loaded, error] = useFonts({
    "Nohemi-Bold": require("../../assets/fonts/Nohemi-Bold.ttf"),
    "Nohemi-Medium": require("../../assets/fonts/Nohemi-Medium.ttf"),
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    DancingScript_700Bold,
  });

  useEffect(() => {
    // Polices chargées, ou échec : on affiche quand même l'application (polices du système).
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.white } }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="circuit/[agence]/[slug]" />
        <Stack.Screen name="reserver/[depart]" />
        <Stack.Screen name="paiement/[id]" />
        <Stack.Screen name="reservation/[id]" />
        <Stack.Screen name="connexion" options={{ presentation: "modal" }} />
        <Stack.Screen name="inscription" options={{ presentation: "modal" }} />
      </Stack>
    </AuthProvider>
  );
}
