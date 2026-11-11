import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

import { colors, fonts } from "@/theme/tokens";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Icône d'onglet : pleine si l'onglet est actif, en contour sinon. */
function TabIcon({
  focused,
  color,
  active,
  inactive,
}: {
  focused: boolean;
  color: ColorValue;
  active: IconName;
  inactive: IconName;
}) {
  return (
    <Ionicons
      name={focused ? active : inactive}
      size={24}
      color={typeof color === "string" ? color : colors.white}
    />
  );
}

/**
 * Barre d'onglets d'après la maquette : fond bleu-vert foncé, coins arrondis, icône et libellé.
 * Onglets : Accueil, Explorer, Réservations, Compte.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.sand300,
        tabBarInactiveTintColor: "rgba(255, 255, 255, 0.8)",
        tabBarStyle: {
          backgroundColor: colors.teal900,
          borderTopWidth: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: 76,
          paddingTop: 8,
          position: "absolute",
        },
        tabBarLabelStyle: { fontFamily: fonts.textMedium, fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: (p) => <TabIcon {...p} active="home" inactive="home-outline" />,
        }}
      />
      <Tabs.Screen
        name="explorer"
        options={{
          title: "Explorer",
          tabBarIcon: (p) => <TabIcon {...p} active="compass" inactive="compass-outline" />,
        }}
      />
      <Tabs.Screen
        name="reservations"
        options={{
          title: "Réservations",
          tabBarIcon: (p) => <TabIcon {...p} active="ticket" inactive="ticket-outline" />,
        }}
      />
      <Tabs.Screen
        name="compte"
        options={{
          title: "Compte",
          tabBarIcon: (p) => <TabIcon {...p} active="person" inactive="person-outline" />,
        }}
      />
    </Tabs>
  );
}
