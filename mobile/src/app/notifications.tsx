import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/form";
import { RequireAuth } from "@/components/require-auth";
import { ScreenHeader } from "@/components/screen-header";
import { Empty, ErrorState, Loading } from "@/components/states";
import { useActivity } from "@/context/activity";
import { useAsync } from "@/hooks/use-async";
import { type AppNotification, fetchNotifications, markNotificationsRead } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

export default function NotificationsScreen() {
  return (
    <RequireAuth>
      <Notifications />
    </RequireAuth>
  );
}

/** Notifications du voyageur (confirmation, paiement, annulation…), les plus récentes d'abord. */
function Notifications() {
  const styles = useStyles();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { refresh } = useActivity();
  const { data, error, reload } = useAsync(() => fetchNotifications(), "notifications");
  useFocusEffect(useCallback(() => reload(), [reload]));

  async function openItem(n: AppNotification) {
    if (!n.lue) {
      await markNotificationsRead([n.id]).catch(() => undefined);
      refresh();
    }
    if (n.reservationId) {
      router.push({ pathname: "/reservation/[id]", params: { id: n.reservationId } });
    } else if (n.itineraireId) {
      router.push({ pathname: "/itineraires/[id]", params: { id: n.itineraireId } });
    } else reload();
  }

  async function readAll() {
    await markNotificationsRead().catch(() => undefined);
    refresh();
    reload();
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader kicker="Votre compte" title="Notifications" />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <FlatList
          data={data.notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListHeaderComponent={
            data.nonLues > 0 ? (
              <Button
                label="Tout marquer comme lu"
                variant="secondary"
                onPress={() => void readAll()}
              />
            ) : undefined
          }
          ListHeaderComponentStyle={{ marginBottom: 12 }}
          ListEmptyComponent={<Empty message="Aucune notification pour le moment." />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => void openItem(item)}
              style={[styles.card, !item.lue && styles.unread]}
              accessibilityRole="button"
              accessibilityLabel={`${item.lue ? "" : "Non lue. "}${item.titre}. ${item.message}`}
            >
              <View style={styles.icon}>
                <Ionicons name="notifications-outline" size={20} color={theme.accent} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.title}>{item.titre}</Text>
                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.time}>{formatDateTime(item.at)}</Text>
              </View>
              {!item.lue ? <View style={styles.dot} /> : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    list: { padding: 18 },
    card: {
      flexDirection: "row",
      gap: 12,
      backgroundColor: t.surface,
      borderRadius: radius.md,
      padding: 14,
      borderWidth: 1,
      borderColor: "transparent",
    },
    unread: { borderColor: t.accent },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontFamily: fonts.textSemiBold, fontSize: 14, color: t.text },
    message: { fontFamily: fonts.text, fontSize: 13, lineHeight: 19, color: t.textMuted },
    time: { fontFamily: fonts.text, fontSize: 11, color: t.textMuted },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.danger, marginTop: 4 },
  }),
);
