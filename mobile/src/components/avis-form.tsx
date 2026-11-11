import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ApiError, postAvis } from "@/lib/api";
import { colors, fonts } from "@/theme/tokens";

import { Button, Field, FormError } from "./form";

const LABELS = ["Très décevant", "Décevant", "Correct", "Très bien", "Excellent"];

/**
 * Avis sur un séjour terminé (RG 17) : note de 1 à 5 (boutons accessibles, libellé en texte)
 * et commentaire facultatif ; publié sur le site après relecture par l'agence.
 */
export function AvisForm({
  reservationId,
  onDone,
}: {
  reservationId: string;
  onDone: (message: string) => void;
}) {
  const [note, setNote] = useState(0);
  const [commentaire, setCommentaire] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (note === 0) return setError("Choisissez une note.");
    setError(null);
    setPending(true);
    try {
      const res = await postAvis(reservationId, { note, commentaire });
      onDone(res.message);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Envoi impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel="Votre note">
        {LABELS.map((label, i) => {
          const n = i + 1;
          return (
            <Pressable
              key={n}
              onPress={() => setNote(n)}
              hitSlop={4}
              accessibilityRole="radio"
              accessibilityState={{ checked: note === n }}
              accessibilityLabel={`${n} sur 5 : ${label}`}
            >
              <Ionicons
                name={n <= note ? "star" : "star-outline"}
                size={34}
                color={n <= note ? colors.star : colors.mist}
              />
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.label}>{note > 0 ? LABELS[note - 1] : "Touchez une étoile"}</Text>
      <FormError message={error} />
      <Field
        label="Votre commentaire (facultatif)"
        value={commentaire}
        onChangeText={setCommentaire}
        multiline
        maxLength={1000}
        hint="Publié avec votre prénom et l'initiale de votre nom, après relecture par l'agence."
        style={{ minHeight: 90, textAlignVertical: "top" }}
      />
      <Button
        label={pending ? "Envoi…" : "Envoyer mon avis"}
        pending={pending}
        onPress={() => void submit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: "row", gap: 6 },
  label: { fontFamily: fonts.textMedium, fontSize: 13, color: colors.teal900 },
});
