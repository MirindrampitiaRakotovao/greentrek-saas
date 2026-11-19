import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Field, FormError } from "@/components/form";
import { RequireAuth } from "@/components/require-auth";
import { ScreenHeader } from "@/components/screen-header";
import { ApiError, startPrivateConversation } from "@/lib/api";
import { makeStyles } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

export default function WriteVoyageurScreen() {
  return (
    <RequireAuth>
      <WriteVoyageur />
    </RequireAuth>
  );
}

/** Premier message à un autre voyageur ; la conversation existante entre vous est reprise. */
function WriteVoyageur() {
  const styles = useStyles();
  const { id, nom } = useLocalSearchParams<{ id: string; nom?: string }>();
  const insets = useSafeAreaInsets();
  const [contenu, setContenu] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const { conversationId } = await startPrivateConversation(id, contenu);
      router.replace({ pathname: "/messages/[id]", params: { id: conversationId } });
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Envoi impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader kicker="Voyageurs" title={nom ? `Écrire à ${nom}` : "Écrire"} />
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <FormError message={error} />
          <Field
            label="Votre message"
            value={contenu}
            onChangeText={setContenu}
            multiline
            maxLength={2000}
            placeholder="Bonjour ! Vous avez fait ce circuit ?"
            style={{ minHeight: 120, textAlignVertical: "top" }}
          />
          <Text style={styles.small}>
            Seuls vos prénom, initiale et photo sont visibles. L&apos;agence ne lit pas cette
            conversation, sauf un message qui lui est signalé.
          </Text>
          <Button
            label={pending ? "Envoi…" : "Envoyer"}
            pending={pending}
            disabled={!contenu.trim()}
            onPress={() => void submit()}
          />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 18 },
    card: { backgroundColor: t.surface, borderRadius: radius.md, padding: 16, gap: 12 },
    small: { fontFamily: fonts.text, fontSize: 12, lineHeight: 17, color: t.textMuted },
  }),
);
