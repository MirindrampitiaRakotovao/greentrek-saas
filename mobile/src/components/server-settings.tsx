import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ApiError, fetchCatalogue } from "@/lib/api";
import { apiBaseUrl, DEFAULT_API_BASE_URL, normalizeServerUrl, setApiBaseUrl } from "@/lib/config";
import { colors, fonts, radius } from "@/theme/tokens";

import { Button, Field } from "./form";

/**
 * « Adresse du serveur » : l'ordinateur qui fait tourner le site Green Trek (même Wi-Fi). Pour
 * l'application installée (APK) le jour de la démonstration : l'adresse de l'ordinateur change
 * d'un réseau à l'autre. L'adresse est testée (catalogue) avant d'être enregistrée.
 */
export function ServerSettings() {
  const [value, setValue] = useState(apiBaseUrl());
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function save(next: string | null) {
    const url = next === null ? null : normalizeServerUrl(next);
    if (next !== null && !url) {
      return setStatus({ ok: false, text: "Adresse invalide, par exemple 192.168.1.20:3000." });
    }
    const previous = apiBaseUrl();
    setPending(true);
    setStatus(null);
    await setApiBaseUrl(url);
    try {
      const { agences } = await fetchCatalogue();
      setValue(apiBaseUrl());
      setStatus({
        ok: true,
        text: `Connecté à ${apiBaseUrl()} : ${agences.length} agence${agences.length > 1 ? "s" : ""}. Tirez les listes vers le bas pour les actualiser.`,
      });
    } catch (e: unknown) {
      // Serveur injoignable : on garde l'adresse précédente.
      await setApiBaseUrl(previous === DEFAULT_API_BASE_URL ? null : previous);
      setStatus({
        ok: false,
        text:
          e instanceof ApiError && e.status === 0
            ? `Aucun serveur Green Trek à cette adresse.`
            : "Échec du test.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="server-outline" size={20} color={colors.teal700} />
        <Text style={styles.title}>Adresse du serveur</Text>
      </View>
      <Text style={styles.small}>
        Ordinateur qui fait tourner le site Green Trek, sur le même Wi-Fi que ce téléphone.
      </Text>
      <Field
        label="Adresse"
        value={value}
        onChangeText={setValue}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="192.168.1.20:3000"
      />
      {status ? (
        <Text
          style={[styles.status, { color: status.ok ? colors.teal700 : colors.danger }]}
          accessibilityLiveRegion="polite"
        >
          {status.text}
        </Text>
      ) : null}
      <Button
        label={pending ? "Test…" : "Tester et enregistrer"}
        pending={pending}
        onPress={() => void save(value)}
      />
      {apiBaseUrl() !== DEFAULT_API_BASE_URL ? (
        <Button label="Adresse par défaut" variant="secondary" onPress={() => void save(null)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: 14, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: fonts.textSemiBold, fontSize: 15, color: colors.teal900 },
  small: { fontFamily: fonts.text, fontSize: 12, lineHeight: 17, color: colors.muted },
  status: { fontFamily: fonts.text, fontSize: 13, lineHeight: 18 },
});
