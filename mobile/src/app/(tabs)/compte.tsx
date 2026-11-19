import { router } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { Segmented } from "@/components/glass";
import { ListGroup, ListRow } from "@/components/list";
import { TabHeader } from "@/components/tab-header";
import { useActivity } from "@/context/activity";
import { useAuth } from "@/context/auth";
import { apiBaseUrl } from "@/lib/config";
import { confirmAction } from "@/lib/confirm";
import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius, type ThemePreference } from "@/theme/tokens";

/**
 * Onglet « Compte » (style des Réglages d'iOS) : profil, messages et notifications, apparence
 * (système, clair, sombre), serveur, déconnexion.
 */
export default function CompteScreen() {
  const { user, logout } = useAuth();
  const { unread } = useActivity();
  const { preference, setPreference } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();
  const s = useStyles();
  if (!user) return null;

  async function signOut() {
    const ok = await confirmAction({
      title: "Se déconnecter ?",
      message: "Vous reviendrez à l'écran de connexion.",
      confirmLabel: "Se déconnecter",
    });
    if (ok) await logout();
  }

  return (
    <View style={s.screen}>
      <TabHeader kicker="Votre espace" title="Compte" />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: tabBarHeight + 24 }]}>
        <View style={s.profile}>
          <Avatar name={`${user.prenom} ${user.nom}`} photo={user.photoUrl} size={60} />
          <View style={{ flex: 1 }}>
            <Text style={s.name}>
              {user.prenom} {user.nom}
            </Text>
            <Text style={s.email} numberOfLines={1}>
              {user.email}
            </Text>
            <Text style={s.agence}>{user.agenceNom}</Text>
          </View>
        </View>

        <ListGroup title="Activité">
          <ListRow
            icon="chatbubbles-outline"
            label="Messages"
            count={unread.conversations}
            onPress={() => router.push("/messages")}
          />
          <ListRow
            icon="people-outline"
            label="Voyageurs"
            value="Échanger avec d'autres voyageurs"
            onPress={() => router.push("/voyageurs")}
          />
          <ListRow
            icon="notifications-outline"
            label="Notifications"
            count={unread.notifications}
            onPress={() => router.push("/notifications")}
          />
        </ListGroup>

        <ListGroup title="Voyages sur mesure">
          <ListRow
            icon="map-outline"
            label="Mes itinéraires"
            value="Proposés par votre agence ou demandés"
            onPress={() => router.push("/itineraires")}
          />
          <ListRow
            icon="add-circle-outline"
            label="Créer mon itinéraire"
            value="Villages, sentiers, le meilleur parcours"
            onPress={() => router.push("/itineraires/nouveau")}
          />
        </ListGroup>

        <ListGroup title="Compte">
          <ListRow
            icon="person-outline"
            label="Mon profil"
            value="Coordonnées et mot de passe"
            onPress={() => router.push("/profil")}
          />
          <ListRow
            icon="server-outline"
            label="Adresse du serveur"
            value={apiBaseUrl()}
            onPress={() => router.push("/serveur")}
          />
        </ListGroup>

        <ListGroup title="Apparence">
          <View style={{ padding: 10 }}>
            <Segmented<ThemePreference>
              options={[
                { key: "system", label: "Système" },
                { key: "light", label: "Clair" },
                { key: "dark", label: "Sombre" },
              ]}
              value={preference}
              onChange={setPreference}
            />
          </View>
        </ListGroup>

        <ListGroup>
          <ListRow
            icon="log-out-outline"
            label="Se déconnecter"
            danger
            onPress={() => void signOut()}
          />
        </ListGroup>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 18, paddingTop: 8, gap: 22 },
    profile: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: t.surface,
      borderRadius: radius.md,
      padding: 16,
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: t.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    initials: { fontFamily: fonts.display, fontSize: 22, color: t.onPrimary },
    name: { fontFamily: fonts.display, fontSize: 19, color: t.text },
    email: { fontFamily: fonts.text, fontSize: 13, color: t.textMuted },
    agence: { fontFamily: fonts.textMedium, fontSize: 12, color: t.accent, marginTop: 2 },
  }),
);
