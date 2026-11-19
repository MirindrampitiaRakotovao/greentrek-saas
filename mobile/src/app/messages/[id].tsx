import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, presenceLabel } from "@/components/avatar";
import { RequireAuth } from "@/components/require-auth";
import { ScreenHeader } from "@/components/screen-header";
import { ErrorState, Loading } from "@/components/states";
import { useActivity } from "@/context/activity";
import { useAsync } from "@/hooks/use-async";
import { ApiError, blockVoyageur, fetchThread, postMessage, reportMessage } from "@/lib/api";
import { confirmAction } from "@/lib/confirm";
import { formatDateTime } from "@/lib/format";
import { playSentSound } from "@/lib/sounds";
import { makeStyles, useTheme } from "@/theme/theme";
import { colors, fonts, radius } from "@/theme/tokens";

/** Fil ouvert : relu toutes les 5 secondes (réponse et accusé de lecture sans action). */
const THREAD_POLL_MS = 5_000;
const MESSAGE_MAX = 2000;

/** Message parti tout de suite dans le fil, en attendant (ou faute de) la réponse du serveur. */
type Outgoing = { key: number; contenu: string; etat: "ENVOI" | "ENVOYE" | "ECHEC" };
type Statut = "ENVOI" | "DISTRIBUE" | "LU";

export default function ThreadScreen() {
  return (
    <RequireAuth>
      <Thread />
    </RequireAuth>
  );
}

function Thread() {
  const styles = useStyles();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { refresh } = useActivity();
  const { data, error, reload } = useAsync(() => fetchThread(id), id);
  const [text, setText] = useState("");
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const nextKey = useRef(0);
  const scroll = useRef<ScrollViewInstance>(null);

  // Nouveau dernier message reçu du serveur : les messages envoyés y sont, la file se vide.
  const lastId = data?.messages.at(-1)?.id;
  const [seenLastId, setSeenLastId] = useState(lastId);
  if (seenLastId !== lastId) {
    setSeenLastId(lastId);
    setOutbox((items) => items.filter((o) => o.etat !== "ENVOYE"));
  }

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

  async function deliver(item: Outgoing) {
    try {
      await postMessage(id, item.contenu);
      setOutbox((items) => items.map((o) => (o.key === item.key ? { ...o, etat: "ENVOYE" } : o)));
      playSentSound();
      reload();
    } catch {
      setOutbox((items) => items.map((o) => (o.key === item.key ? { ...o, etat: "ECHEC" } : o)));
    }
  }

  function send() {
    const contenu = text.trim();
    if (!contenu) return;
    const item: Outgoing = { key: nextKey.current++, contenu, etat: "ENVOI" };
    setOutbox((items) => [...items, item]);
    setText("");
    void deliver(item);
  }

  function retry(item: Outgoing) {
    setOutbox((items) => items.map((o) => (o.key === item.key ? { ...o, etat: "ENVOI" } : o)));
    void deliver(item);
  }

  const toEnd = () => scroll.current?.scrollToEnd({ animated: true });
  const [notice, setNotice] = useState<string | null>(null);

  // Conversation entre voyageurs : signaler un message reçu (appui long), bloquer l'autre.
  async function report(messageId: string) {
    const ok = await confirmAction({
      title: "Signaler ce message ?",
      message: "L'agence verra ce message (et seulement celui-ci) pour l'examiner.",
      confirmLabel: "Signaler",
    });
    if (!ok) return;
    try {
      await reportMessage(messageId);
      setNotice("Merci : l'agence va examiner ce message.");
    } catch (e: unknown) {
      setNotice(e instanceof ApiError ? e.message : "Signalement impossible.");
    }
  }

  async function block() {
    const autre = data?.interlocuteur;
    if (!autre) return;
    const ok = await confirmAction({
      title: `Bloquer ${autre.nom} ?`,
      message: "Vous ne pourrez plus vous écrire. Vous pourrez le débloquer depuis « Voyageurs ».",
      confirmLabel: "Bloquer",
    });
    if (!ok) return;
    try {
      await blockVoyageur(autre.id);
      router.replace("/voyageurs");
    } catch (e: unknown) {
      setNotice(e instanceof ApiError ? e.message : "Action impossible.");
    }
  }

  const presence = presenceLabel(data?.interlocuteur ?? data?.presenceAgence);

  return (
    // Le clavier pousse toute la zone de saisie : rien de ce qu'on écrit n'est caché. La marge
    // du bas (barre système) passe sous le clavier ouvert (décalage négatif).
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={-insets.bottom}
      style={styles.screen}
    >
      <ScreenHeader
        kicker={
          data?.interlocuteur
            ? `Voyageur${presence ? ` · ${presence}` : ""}`
            : `Messages${presence ? ` · agence ${presence}` : ""}`
        }
        title={data?.sujet ?? "Conversation"}
        right={
          data?.interlocuteur && !data.interlocuteur.bloque ? (
            <Pressable
              onPress={() => void block()}
              accessibilityRole="button"
              accessibilityLabel={`Bloquer ${data.interlocuteur.nom}`}
              style={styles.blockBtn}
            >
              <Ionicons name="ban-outline" size={16} color={theme.danger} />
              <Text style={styles.blockText}>Bloquer</Text>
            </Pressable>
          ) : null
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <ScrollView
            ref={scroll}
            contentContainerStyle={styles.thread}
            onContentSizeChange={toEnd}
            onLayout={toEnd}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
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
                <Ionicons name="ticket-outline" size={16} color={theme.accent} />
                <Text style={styles.reservationText} numberOfLines={1}>
                  {data.reservation.circuit} · {data.reservation.reference}
                </Text>
              </Pressable>
            ) : null}
            {data.prive ? (
              <Text style={styles.hint}>
                {data.interlocuteur?.bloque
                  ? "Vous ne pouvez plus vous écrire (blocage)."
                  : "Conversation privée : l'agence ne la lit pas. Appui long sur un message reçu pour le signaler."}
              </Text>
            ) : null}
            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            {data.messages.map((m) => (
              <Pressable
                key={m.id}
                style={[styles.line, m.deMoi && styles.lineMine]}
                onLongPress={data.prive && !m.deMoi ? () => void report(m.id) : undefined}
                accessibilityHint={
                  data.prive && !m.deMoi ? "Appui long pour signaler ce message" : undefined
                }
              >
                {!m.deMoi ? <Avatar name={m.auteur} photo={m.photo} size={30} /> : null}
                <View style={[styles.bubble, m.deMoi ? styles.mine : styles.theirs]}>
                  {!m.deMoi ? (
                    <Text style={styles.author}>
                      {m.auteur}
                      {m.cote ? ` · ${m.cote}` : ""}
                    </Text>
                  ) : null}
                  <Text style={[styles.body, m.deMoi && styles.bodyMine]}>{m.contenu}</Text>
                  <Meta at={formatDateTime(m.at)} mine={m.deMoi} statut={m.statut} />
                </View>
              </Pressable>
            ))}
            {outbox.map((o) =>
              o.etat === "ECHEC" ? (
                <Pressable
                  key={`envoi-${o.key}`}
                  onPress={() => retry(o)}
                  style={[styles.bubble, styles.mine, styles.failed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Non envoyé : ${o.contenu}. Toucher pour réessayer.`}
                >
                  <Text style={[styles.body, styles.bodyMine]}>{o.contenu}</Text>
                  <View style={styles.meta}>
                    <Ionicons name="alert-circle" size={14} color={colors.sand300} />
                    <Text style={styles.failedText}>Non envoyé · toucher pour réessayer</Text>
                  </View>
                </Pressable>
              ) : (
                <View key={`envoi-${o.key}`} style={[styles.bubble, styles.mine, styles.pending]}>
                  <Text style={[styles.body, styles.bodyMine]}>{o.contenu}</Text>
                  <Meta mine statut={o.etat === "ENVOYE" ? "DISTRIBUE" : "ENVOI"} />
                </View>
              ),
            )}
          </ScrollView>
          <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
            <View style={styles.row}>
              <TextInput
                value={text}
                onChangeText={setText}
                onFocus={() => setTimeout(toEnd, 250)}
                placeholder="Votre message…"
                placeholderTextColor={theme.textMuted}
                multiline
                maxLength={MESSAGE_MAX}
                style={styles.input}
                accessibilityLabel="Votre message"
              />
              <Pressable
                onPress={send}
                disabled={!text.trim()}
                style={[styles.send, !text.trim() && { opacity: 0.5 }]}
                accessibilityRole="button"
                accessibilityLabel="Envoyer"
              >
                <Ionicons name="send" size={18} color={theme.onPrimary} />
              </Pressable>
            </View>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const STATUS: Record<
  Statut,
  { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string }
> = {
  ENVOI: { icon: "time-outline", label: "Envoi…" },
  DISTRIBUE: { icon: "checkmark", label: "Distribué" },
  LU: { icon: "checkmark-done", label: "Lu" },
};

/** Heure et, sous mes messages, statut : pictogramme ET texte (jamais la couleur seule). */
function Meta({ at, mine, statut }: { at?: string; mine: boolean; statut: Statut | null }) {
  const styles = useStyles();
  const s = mine && statut ? STATUS[statut] : null;
  return (
    <View style={styles.meta}>
      {at ? <Text style={[styles.time, mine && styles.timeMine]}>{at}</Text> : null}
      {s ? (
        <View style={styles.meta} accessible accessibilityLabel={s.label}>
          <Ionicons
            name={s.icon}
            size={15}
            color={statut === "LU" ? colors.sand300 : "rgba(255,255,255,0.85)"}
          />
          <Text style={[styles.time, styles.timeMine, statut === "LU" && styles.read]}>
            {s.label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    thread: { padding: 18, gap: 10 },
    hint: {
      fontFamily: fonts.text,
      fontSize: 12,
      lineHeight: 17,
      color: t.textMuted,
      textAlign: "center",
      marginBottom: 4,
    },
    notice: {
      fontFamily: fonts.textMedium,
      fontSize: 13,
      color: t.accent,
      textAlign: "center",
    },
    blockBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.pill,
      backgroundColor: t.dangerSoft,
    },
    blockText: { fontFamily: fonts.textSemiBold, fontSize: 13, color: t.danger },
    reservation: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "center",
      backgroundColor: t.accentSoft,
      borderRadius: radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginBottom: 6,
      maxWidth: "100%",
    },
    reservationText: { fontFamily: fonts.textMedium, fontSize: 12, color: t.text },
    line: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    lineMine: { justifyContent: "flex-end" },
    bubble: {
      maxWidth: "82%",
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 3,
    },
    mine: { alignSelf: "flex-end", backgroundColor: colors.teal700, borderBottomRightRadius: 4 },
    theirs: { alignSelf: "flex-start", backgroundColor: t.surface, borderBottomLeftRadius: 4 },
    pending: { opacity: 0.75 },
    failed: { backgroundColor: colors.teal900 },
    failedText: { fontFamily: fonts.textMedium, fontSize: 11, color: colors.sand300 },
    author: { fontFamily: fonts.textSemiBold, fontSize: 12, color: t.accent },
    body: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: t.text },
    bodyMine: { color: colors.white },
    meta: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end" },
    time: { fontFamily: fonts.text, fontSize: 10, color: t.textMuted },
    timeMine: { color: "rgba(255,255,255,0.85)" },
    read: { fontFamily: fonts.textSemiBold, color: colors.sand300 },
    composer: {
      backgroundColor: t.surface,
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
      borderColor: t.border,
      paddingHorizontal: 16,
      paddingTop: 11,
      paddingBottom: 11,
      fontFamily: fonts.text,
      fontSize: 14,
      color: t.text,
    },
    send: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.primary,
      alignItems: "center",
      justifyContent: "center",
    },
  }),
);
