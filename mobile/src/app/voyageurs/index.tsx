import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, presenceLabel } from "@/components/avatar";
import { RequireAuth } from "@/components/require-auth";
import { ScreenHeader } from "@/components/screen-header";
import { Empty, ErrorState, Loading } from "@/components/states";
import { useAsync } from "@/hooks/use-async";
import { ApiError, fetchVoyageurs, unblockVoyageur } from "@/lib/api";
import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

export default function VoyageursScreen() {
  return (
    <RequireAuth>
      <Voyageurs />
    </RequireAuth>
  );
}

/**
 * Voyageurs de l'agence qui acceptent les messages (étape 5c) : prénom, initiale, photo et
 * présence ; « Écrire » ouvre le premier message. Voyageurs bloqués en bas de liste.
 */
function Voyageurs() {
  const styles = useStyles();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const {
    data,
    error: loadError,
    loading,
    reload,
  } = useAsync(() => fetchVoyageurs(search), `voyageurs#${search}`);
  useFocusEffect(useCallback(() => reload(), [reload]));

  async function unblock(id: string) {
    setError(null);
    try {
      await unblockVoyageur(id);
      reload();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Action impossible.");
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader kicker="Messages" title="Voyageurs" />
      <View style={styles.search}>
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => setSearch(q)}
          returnKeyType="search"
          placeholder="Rechercher un prénom ou un nom"
          placeholderTextColor={theme.textMuted}
          style={styles.input}
          accessibilityLabel="Rechercher un voyageur"
        />
      </View>
      {loadError ? (
        <ErrorState message={loadError} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <FlatList
          data={data.voyageurs}
          keyExtractor={(v) => v.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshing={loading}
          onRefresh={reload}
          ListHeaderComponent={
            <Text style={styles.intro}>
              Conseils, souvenirs, randonnées à plusieurs : seuls le prénom, l&apos;initiale et la
              photo sont visibles. L&apos;agence ne lit pas vos conversations.
            </Text>
          }
          ListEmptyComponent={<Empty message="Aucun voyageur ne correspond." />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Avatar name={item.nom} photo={item.photo} size={46} online={item.enLigne} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.nom}</Text>
                {presenceLabel(item) ? (
                  <Text style={styles.small}>{presenceLabel(item)}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/voyageurs/ecrire",
                    params: { id: item.id, nom: item.nom },
                  })
                }
                style={styles.write}
                accessibilityRole="button"
                accessibilityLabel={`Écrire à ${item.nom}`}
              >
                <Text style={styles.writeText}>Écrire</Text>
              </Pressable>
            </View>
          )}
          ListFooterComponent={
            data.bloques.length ? (
              <View style={styles.blocked}>
                <Text style={styles.h2}>Voyageurs bloqués</Text>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                {data.bloques.map((b) => (
                  <View key={b.id} style={styles.row}>
                    <Avatar name={b.nom} photo={b.photo} size={32} />
                    <Text style={[styles.name, { flex: 1 }]}>{b.nom}</Text>
                    <Pressable
                      onPress={() => void unblock(b.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Débloquer ${b.nom}`}
                    >
                      <Text style={styles.link}>Débloquer</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : undefined
          }
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    search: { paddingHorizontal: 18, paddingBottom: 8 },
    input: {
      minHeight: 44,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      paddingHorizontal: 16,
      fontFamily: fonts.text,
      fontSize: 14,
      color: t.text,
    },
    list: { padding: 18 },
    intro: {
      fontFamily: fonts.text,
      fontSize: 13,
      lineHeight: 19,
      color: t.textMuted,
      marginBottom: 14,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: t.surface,
      borderRadius: radius.md,
      padding: 14,
    },
    name: { fontFamily: fonts.textSemiBold, fontSize: 15, color: t.text },
    small: { fontFamily: fonts.text, fontSize: 12, color: t.textMuted },
    write: {
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: t.accent,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    writeText: { fontFamily: fonts.textSemiBold, fontSize: 13, color: t.accent },
    blocked: { marginTop: 24, gap: 10 },
    h2: { fontFamily: fonts.display, fontSize: 18, color: t.text },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    link: { fontFamily: fonts.textSemiBold, fontSize: 13, color: t.accent },
    error: { fontFamily: fonts.textMedium, fontSize: 13, color: t.danger },
  }),
);
