import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Field, FormError } from "@/components/form";
import { RequireAuth } from "@/components/require-auth";
import { ScreenHeader } from "@/components/screen-header";
import { useAuth } from "@/context/auth";
import { ApiError, startConversation } from "@/lib/api";
import { colors, fonts, radius } from "@/theme/tokens";

export default function NewMessageScreen() {
  return (
    <RequireAuth>
      <NewMessage />
    </RequireAuth>
  );
}

/**
 * Écrire à l'agence du compte : au sujet d'une réservation (`?reservation=<id>`, depuis sa
 * fiche ; la conversation existante est reprise) ou question générale avec un sujet.
 */
function NewMessage() {
  const params = useLocalSearchParams<{ reservation?: string; reference?: string }>();
  const reservationId = params.reservation ?? null;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [sujet, setSujet] = useState("");
  const [contenu, setContenu] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setErrors({});
    setError(null);
    try {
      const { conversationId } = await startConversation({
        reservationId,
        sujet: reservationId ? null : sujet.trim() || null,
        contenu,
      });
      router.replace({ pathname: "/messages/[id]", params: { id: conversationId } });
    } catch (e: unknown) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      setError(e instanceof ApiError ? e.message : "Envoi impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.screen}>
        <ScreenHeader kicker="Messages" title="Écrire à l'agence" />
        <KeyboardAwareScrollView
          bottomOffset={24}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.small}>
              Destinataire : {user!.agenceNom}
              {params.reference ? ` · réservation ${params.reference}` : ""}
            </Text>
            <FormError message={error} />
            {reservationId ? null : (
              <Field
                label="Sujet (facultatif)"
                value={sujet}
                onChangeText={setSujet}
                maxLength={200}
                error={errors.sujet}
              />
            )}
            <Field
              label="Votre message"
              value={contenu}
              onChangeText={setContenu}
              multiline
              maxLength={2000}
              style={{ minHeight: 120, textAlignVertical: "top" }}
              error={errors.contenu}
            />
            <Button
              label={pending ? "Envoi…" : "Envoyer"}
              pending={pending}
              onPress={() => void submit()}
            />
          </View>
        </KeyboardAwareScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 18 },
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: 16, gap: 12 },
  small: { fontFamily: fonts.text, fontSize: 13, color: colors.muted },
});
