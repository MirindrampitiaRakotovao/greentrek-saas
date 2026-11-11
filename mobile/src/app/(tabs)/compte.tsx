import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { CountBadge } from "@/components/badge";
import { Button } from "@/components/form";
import { ServerSettings } from "@/components/server-settings";
import { useActivity } from "@/context/activity";
import { useAuth } from "@/context/auth";
import { confirmAction } from "@/lib/confirm";
import { colors, fonts, radius } from "@/theme/tokens";

/** Onglet « Compte » : profil du voyageur et déconnexion, ou invitation à se connecter. */
export default function CompteScreen() {
  const { user, logout } = useAuth();
  const { unread } = useActivity();

  async function signOut() {
    const ok = await confirmAction({
      title: "Se déconnecter ?",
      message: "Vous devrez vous reconnecter pour réserver ou voir vos réservations.",
      confirmLabel: "Se déconnecter",
    });
    if (ok) await logout();
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.script}>Votre espace</Text>
          <Text style={styles.title} accessibilityRole="header">
            Compte
          </Text>
        </View>
        <View style={styles.content}>
          {user === null ? (
            <>
              <Text style={styles.paragraph}>
                Un compte voyageur est propre à une agence : créez-le auprès de l’agence de votre
                circuit, puis connectez-vous pour réserver.
              </Text>
              <Button label="Se connecter" onPress={() => router.push("/connexion")} />
              <Button
                label="Créer un compte"
                variant="secondary"
                onPress={() => router.push("/inscription")}
              />
            </>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.avatar}>
                  <Text style={styles.initials}>
                    {(user.prenom[0] ?? "").toUpperCase()}
                    {(user.nom[0] ?? "").toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.name}>
                  {user.prenom} {user.nom}
                </Text>
                <Text style={styles.paragraph}>{user.email}</Text>
                {user.telephone ? <Text style={styles.paragraph}>{user.telephone}</Text> : null}
              </View>
              <View style={styles.row}>
                <Ionicons name="business-outline" size={20} color={colors.teal700} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.small}>Agence du compte</Text>
                  <Text style={styles.strong}>{user.agenceNom}</Text>
                </View>
              </View>
              <InboxLink
                icon="chatbubbles-outline"
                label="Messages"
                count={unread.conversations}
                onPress={() => router.push("/messages")}
              />
              <InboxLink
                icon="notifications-outline"
                label="Notifications"
                count={unread.notifications}
                onPress={() => router.push("/notifications")}
              />
              <Button
                label="Modifier mon profil"
                variant="secondary"
                onPress={() => router.push("/profil")}
              />
              <Button label="Se déconnecter" variant="danger" onPress={() => void signOut()} />
            </>
          )}
          <ServerSettings />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

/** Ligne « Messages » ou « Notifications » du compte, avec le nombre de non lus. */
function InboxLink({
  icon,
  label,
  count,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.row}
      accessibilityRole="link"
      accessibilityLabel={count ? `${label}, ${count} non lus` : label}
    >
      <View>
        <Ionicons name={icon} size={20} color={colors.teal700} />
        <CountBadge count={count} />
      </View>
      <Text style={[styles.strong, { flex: 1 }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6 },
  script: { fontFamily: fonts.script, fontSize: 22, color: colors.teal600 },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.teal900, marginTop: -4 },
  content: { padding: 18, gap: 14 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 20,
    alignItems: "center",
    gap: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.teal700,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  initials: { fontFamily: fonts.display, fontSize: 26, color: colors.white },
  name: { fontFamily: fonts.display, fontSize: 22, color: colors.teal900 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 14,
  },
  paragraph: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.muted },
  small: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  strong: { fontFamily: fonts.textSemiBold, fontSize: 14, color: colors.teal900 },
});
