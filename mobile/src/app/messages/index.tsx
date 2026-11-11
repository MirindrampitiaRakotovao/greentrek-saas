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
import { fetchConversations } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { colors, fonts, radius } from "@/theme/tokens";

export default function MessagesScreen() {
  return (
    <RequireAuth>
      <Conversations />
    </RequireAuth>
  );
}

/** Conversations du voyageur avec son agence (même messagerie que le site). */
function Conversations() {
  const insets = useSafeAreaInsets();
  const { unread } = useActivity();
  const { data, error, loading, reload } = useAsync(
    () => fetchConversations(),
    `messages#${unread.conversations}`,
  );
  useFocusEffect(useCallback(() => reload(), [reload]));

  return (
    <View style={styles.screen}>
      <ScreenHeader kicker="Votre agence" title="Messages" />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <FlatList
          data={data.conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshing={loading}
          onRefresh={reload}
          ListHeaderComponent={
            <Button label="Écrire à l'agence" onPress={() => router.push("/messages/nouveau")} />
          }
          ListHeaderComponentStyle={{ marginBottom: 14 }}
          ListEmptyComponent={
            <Empty message="Aucun message. Une question sur un circuit ou une réservation ? Écrivez à l'agence." />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: "/messages/[id]", params: { id: item.id } })}
              style={[styles.card, item.nonLue && styles.unread]}
              accessibilityRole="link"
              accessibilityLabel={`${item.nonLue ? "Non lu. " : ""}${item.sujet}`}
            >
              <View style={styles.icon}>
                <Ionicons name="chatbubbles-outline" size={20} color={colors.teal700} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.between}>
                  <Text style={[styles.title, item.nonLue && styles.bold]} numberOfLines={1}>
                    {item.sujet}
                  </Text>
                  <Text style={styles.time}>{formatDateTime(item.at)}</Text>
                </View>
                {item.dernierMessage ? (
                  <Text style={styles.excerpt} numberOfLines={2}>
                    <Text style={styles.author}>{item.dernierMessage.auteur} : </Text>
                    {item.dernierMessage.extrait}
                  </Text>
                ) : null}
              </View>
              {item.nonLue ? <View style={styles.dot} /> : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  list: { padding: 18 },
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  unread: { borderColor: colors.teal600 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.teal100,
    alignItems: "center",
    justifyContent: "center",
  },
  between: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, fontFamily: fonts.textMedium, fontSize: 14, color: colors.teal900 },
  bold: { fontFamily: fonts.textSemiBold },
  time: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
  excerpt: { fontFamily: fonts.text, fontSize: 13, lineHeight: 19, color: colors.muted },
  author: { fontFamily: fonts.textMedium, color: colors.teal800 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger, marginTop: 4 },
});
