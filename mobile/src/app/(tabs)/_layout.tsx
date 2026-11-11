import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CountBadge } from "@/components/badge";
import { Glass } from "@/components/glass";
import { useActivity } from "@/context/activity";
import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const ICONS: Record<string, [IconName, IconName]> = {
  index: ["home", "home-outline"],
  explorer: ["compass", "compass-outline"],
  favoris: ["heart", "heart-outline"],
  reservations: ["ticket", "ticket-outline"],
  compte: ["person", "person-outline"],
};

/**
 * Barre d'onglets flottante en verre (refonte) : pastille autour de l'onglet actif, icône
 * pleine et libellé ; pastille du nombre de non-lus sur « Compte ».
 */
function GlassTabBar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { theme } = useTheme();
  const { unread } = useActivity();
  const unreadTotal = unread.notifications + unread.conversations;
  return (
    <View style={[s.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <Glass rounded={radius.pill} style={s.bar}>
        <View style={s.row}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const { options } = descriptors[route.key]!;
            const label = typeof options.title === "string" ? options.title : route.name;
            const [on, off] = ICONS[route.name] ?? ["ellipse", "ellipse-outline"];
            const badge = route.name === "compte" ? unreadTotal : 0;
            return (
              <Pressable
                key={route.key}
                onPress={() => {
                  if (!focused) navigateToTab(route.key);
                }}
                style={[s.item, focused && s.itemActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={badge ? `${label}, ${badge} non lus` : label}
              >
                <View>
                  <Ionicons
                    name={focused ? on : off}
                    size={22}
                    color={focused ? theme.accent : theme.textMuted}
                  />
                  <CountBadge count={badge} />
                </View>
                <Text style={[s.label, focused && s.labelActive]} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <GlassTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: "Accueil" }} />
      <Tabs.Screen name="explorer" options={{ title: "Explorer" }} />
      <Tabs.Screen name="favoris" options={{ title: "Favoris" }} />
      <Tabs.Screen name="reservations" options={{ title: "Voyages" }} />
      <Tabs.Screen name="compte" options={{ title: "Compte" }} />
    </Tabs>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
    bar: {
      shadowColor: "#000",
      shadowOpacity: t.dark ? 0.4 : 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    row: { flexDirection: "row", padding: 6 },
    item: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      paddingVertical: 8,
      borderRadius: radius.pill,
    },
    itemActive: { backgroundColor: t.accentSoft },
    label: { fontFamily: fonts.textMedium, fontSize: 11, color: t.textMuted },
    labelActive: { fontFamily: fonts.textSemiBold, color: t.text },
  }),
);
