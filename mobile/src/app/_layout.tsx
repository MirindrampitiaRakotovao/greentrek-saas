import { DancingScript_700Bold } from "@expo-google-fonts/dancing-script";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from "@expo-google-fonts/poppins";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { KeyboardProvider } from "react-native-keyboard-controller";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { AnimatedSplash } from "@/components/animated-splash";
import { ServerWatcher } from "@/components/server-watcher";
import { ActivityProvider } from "@/context/activity";
import { AuthProvider, useAuth } from "@/context/auth";
import { FavoritesProvider } from "@/context/favorites";
import { ThemeProvider, useTheme } from "@/theme/theme";
import { colors } from "@/theme/tokens";

SplashScreen.preventAutoHideAsync();

/**
 * Racine de l'application Green Trek (voyageurs) : polices du site (Nohemi, Poppins, Dancing
 * Script), thème clair ou sombre, écran d'ouverture animé, puis la connexion (obligatoire) et
 * l'application : les onglets, et les écrans empilés par-dessus.
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

  // Écran d'ouverture animé, une fois par lancement : l'application se charge dessous.
  const [intro, setIntro] = useState(true);
  const endIntro = useCallback(() => setIntro(false), []);

  useEffect(() => {
    // Polices chargées, ou échec : on affiche quand même l'application (polices du système).
    // L'animation prend alors le relais du splash natif, au même endroit.
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <ThemeProvider>
      <View style={{ flex: 1, backgroundColor: colors.teal900 }}>
        <App />
        {intro ? <AnimatedSplash onDone={endIntro} /> : null}
      </View>
    </ThemeProvider>
  );
}

function App() {
  const { theme } = useTheme();
  return (
    <KeyboardProvider>
      <AuthProvider>
        <ActivityProvider>
          <FavoritesProvider>
            <StatusBar style={theme.dark ? "light" : "dark"} />
            <Navigation />
            <ServerWatcher />
          </FavoritesProvider>
        </ActivityProvider>
      </AuthProvider>
    </KeyboardProvider>
  );
}

/**
 * Navigation protégée : sans session, seuls la connexion, l'inscription, le mot de passe oublié
 * et l'adresse du serveur existent ; connecté, tout le reste. Le changement de session (connexion,
 * déconnexion, jeton refusé) bascule d'un groupe à l'autre sans code de redirection.
 */
function Navigation() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const signedIn = user !== null;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.bg },
        animation: "fade_from_bottom",
      }}
    >
      <Stack.Protected guard={signedIn} redirectTo="/connexion">
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="circuit/[agence]/[slug]" options={{ animation: "default" }} />
        <Stack.Screen name="reserver/[depart]" />
        <Stack.Screen name="paiement/[id]" />
        <Stack.Screen name="reservation/[id]" />
        <Stack.Screen name="profil" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="messages/index" />
        <Stack.Screen name="messages/[id]" />
        <Stack.Screen name="messages/nouveau" />
        <Stack.Screen name="itineraires/index" />
        <Stack.Screen name="itineraires/nouveau" />
        <Stack.Screen name="itineraires/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn} redirectTo="/">
        <Stack.Screen name="connexion" options={{ animation: "fade" }} />
        <Stack.Screen name="inscription" options={{ animation: "fade" }} />
        <Stack.Screen name="mot-de-passe-oublie" />
      </Stack.Protected>
      <Stack.Screen name="serveur" options={{ presentation: "modal" }} />
    </Stack>
  );
}
