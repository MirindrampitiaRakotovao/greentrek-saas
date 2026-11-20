import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { PublicationCard } from "@/components/communaute/publication-card";
import { RequireAuth } from "@/components/require-auth";
import { ScreenHeader } from "@/components/screen-header";
import { ErrorState, Loading } from "@/components/states";
import { useAsync } from "@/hooks/use-async";
import {
  addCommentaire,
  ApiError,
  type CommentaireCommunaute,
  deleteCommentaire,
  fetchPublication,
  reportCommunityContent,
} from "@/lib/api";
import { confirmAction } from "@/lib/confirm";
import { formatDateTime } from "@/lib/format";
import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

export default function PublicationScreen() {
  return (
    <RequireAuth>
      <PublicationDetail />
    </RequireAuth>
  );
}

/** Une publication : photos en entier et commentaires. */
function PublicationDetail() {
  const styles = useStyles();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload } = useAsync(() => fetchPublication(id), id);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    const contenu = text.trim();
    if (!contenu) return;
    setPending(true);
    setMessage(null);
    try {
      await addCommentaire(id, contenu);
      setText("");
      reload();
    } catch (e: unknown) {
      setMessage(e instanceof ApiError ? e.message : "Envoi impossible.");
    } finally {
      setPending(false);
    }
  }

  async function act(c: CommentaireCommunaute) {
    const ok = await confirmAction(
      c.deMoi
        ? {
            title: "Supprimer le commentaire ?",
            message: "Il disparaîtra pour tout le monde.",
            confirmLabel: "Supprimer",
          }
        : {
            title: "Signaler ce commentaire ?",
            message: "L'équipe de la plateforme l'examinera et pourra le masquer.",
            confirmLabel: "Signaler",
          },
    );
    if (!ok) return;
    try {
      if (c.deMoi) {
        await deleteCommentaire(c.id);
        reload();
      } else {
        await reportCommunityContent("COMMENTAIRE", c.id);
        setMessage("Merci : l'équipe de la plateforme va examiner ce contenu.");
      }
    } catch (e: unknown) {
      setMessage(e instanceof ApiError ? e.message : "Action impossible.");
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader kicker="Communauté" title={data ? data.auteur.nom : "Publication"} />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <KeyboardAwareScrollView
          bottomOffset={24}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <PublicationCard p={data} detail credits={data.credits} onMessage={setMessage} />
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Text style={styles.h2}>Commentaires</Text>
          {data.listeCommentaires.length === 0 ? (
            <Text style={styles.small}>Soyez le premier à commenter.</Text>
          ) : (
            data.listeCommentaires.map((c) => (
              <View key={c.id} style={styles.comment}>
                <Avatar name={c.auteur.nom} photo={c.auteur.photo} size={32} />
                <View style={styles.bubble}>
                  <View style={styles.between}>
                    <Text style={styles.author}>
                      {c.auteur.nom} <Text style={styles.small}>· {formatDateTime(c.at)}</Text>
                    </Text>
                    <Pressable
                      onPress={() => void act(c)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={
                        c.deMoi ? "Supprimer le commentaire" : "Signaler le commentaire"
                      }
                    >
                      <Ionicons
                        name={c.deMoi ? "trash-outline" : "flag-outline"}
                        size={16}
                        color={theme.textMuted}
                      />
                    </Pressable>
                  </View>
                  <Text style={styles.body}>{c.contenu}</Text>
                </View>
              </View>
            ))
          )}
          <View style={styles.row}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Votre commentaire…"
              placeholderTextColor={theme.textMuted}
              multiline
              maxLength={1000}
              style={styles.input}
              accessibilityLabel="Votre commentaire"
            />
            <Pressable
              onPress={() => void send()}
              disabled={pending || !text.trim()}
              style={[styles.send, (pending || !text.trim()) && { opacity: 0.5 }]}
              accessibilityRole="button"
              accessibilityLabel="Publier le commentaire"
            >
              <Ionicons name="send" size={18} color={theme.onPrimary} />
            </Pressable>
          </View>
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 18, gap: 12, maxWidth: 640, width: "100%", alignSelf: "center" },
    h2: { fontFamily: fonts.display, fontSize: 18, color: t.text, marginTop: 6 },
    small: { fontFamily: fonts.text, fontSize: 12, color: t.textMuted },
    message: {
      fontFamily: fonts.textMedium,
      fontSize: 13,
      color: t.accent,
      backgroundColor: t.accentSoft,
      borderRadius: radius.sm,
      padding: 10,
    },
    comment: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    bubble: { flex: 1, backgroundColor: t.surface, borderRadius: radius.sm, padding: 10, gap: 3 },
    between: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    author: { flex: 1, fontFamily: fonts.textSemiBold, fontSize: 13, color: t.text },
    body: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: t.text },
    row: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginTop: 6 },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
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
