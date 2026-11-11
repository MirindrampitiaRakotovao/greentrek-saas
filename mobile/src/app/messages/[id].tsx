import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormError } from "@/components/form";
import { RequireAuth } from "@/components/require-auth";
import { ScreenHeader } from "@/components/screen-header";
import { ErrorState, Loading } from "@/components/states";
import { useActivity } from "@/context/activity";
import { useAsync } from "@/hooks/use-async";
import { ApiError, fetchThread, postMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { colors, fonts, radius } from "@/theme/tokens";

/** Fil ouvert : relu toutes les 5 secondes (réponse de l'agence visible sans action). */
const THREAD_POLL_MS = 5_000;
const MESSAGE_MAX = 2000;

export default function ThreadScreen() {
  return (
    <RequireAuth>
      <Thread />
    </RequireAuth>
  );
}

function Thread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { refresh } = useActivity();
  const { data, error, reload } = useAsync(() => fetchThread(id), id);
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);

  // Écran visible : relecture régulière ; l'ouverture marque le fil comme lu (pastilles à jour).
  useFocusEffect(
    useCallback(() => {
      refresh();
      const timer = setInterval(reload, THREAD_POLL_MS);
      return () => {
        clearInterval(timer);
        refresh();
      };
    }, [reload, refresh]),
  );

  async function send() {
    const contenu = text.trim();
    if (!contenu) return setSendError("Écrivez votre message.");
    setPending(true);
    setSendError(null);
    try {
      await postMessage(id, contenu);
      setText("");
      reload();
    } catch (e: unknown) {
      setSendError(e instanceof ApiError ? e.message : "Envoi impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader kicker="Messages" title={data?.sujet ?? "Conversation"} />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <ScrollView
            ref={scroll}
            contentContainerStyle={styles.thread}
            onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
          >
            {data.reservation ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/reservation/[id]",
                    params: { id: data.reservation!.id },
                  })
                }
                style={styles.reservation}
                accessibilityRole="link"
              >
                <Ionicons name="ticket-outline" size={16} color={colors.teal700} />
                <Text style={styles.reservationText} numberOfLines={1}>
                  {data.reservation.circuit} · {data.reservation.reference}
                </Text>
              </Pressable>
            ) : null}
            {data.messages.map((m) => (
              <View key={m.id} style={[styles.bubble, m.deMoi ? styles.mine : styles.theirs]}>
                {!m.deMoi ? (
                  <Text style={styles.author}>
                    {m.auteur}
                    {m.cote ? ` · ${m.cote}` : ""}
                  </Text>
                ) : null}
                <Text style={[styles.body, m.deMoi && styles.bodyMine]}>{m.contenu}</Text>
                <Text style={[styles.time, m.deMoi && styles.timeMine]}>
                  {formatDateTime(m.at)}
                </Text>
              </View>
            ))}
          </ScrollView>
          <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
            <FormError message={sendError} />
            <View style={styles.row}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Votre message…"
                placeholderTextColor={colors.muted}
                multiline
                maxLength={MESSAGE_MAX}
                style={styles.input}
                accessibilityLabel="Votre message"
              />
              <Pressable
                onPress={() => void send()}
                disabled={pending}
                style={[styles.send, pending && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Envoyer"
              >
                <Ionicons name="send" size={18} color={colors.white} />
              </Pressable>
            </View>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  thread: { padding: 18, gap: 10 },
  reservation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    backgroundColor: colors.teal100,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 6,
    maxWidth: "100%",
  },
  reservationText: { fontFamily: fonts.textMedium, fontSize: 12, color: colors.teal800 },
  bubble: { maxWidth: "82%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 3 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.teal700, borderBottomRightRadius: 4 },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.white, borderBottomLeftRadius: 4 },
  author: { fontFamily: fonts.textSemiBold, fontSize: 12, color: colors.teal700 },
  body: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.teal900 },
  bodyMine: { color: colors.white },
  time: { fontFamily: fonts.text, fontSize: 10, color: colors.muted, alignSelf: "flex-end" },
  timeMine: { color: "rgba(255,255,255,0.8)" },
  composer: {
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 6,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.mist,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: fonts.text,
    fontSize: 14,
    color: colors.teal900,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.teal700,
    alignItems: "center",
    justifyContent: "center",
  },
});
