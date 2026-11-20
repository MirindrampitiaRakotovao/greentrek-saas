import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ApiError, fetchCatalogue } from "@/lib/api";
import { apiBaseUrl, DEFAULT_API_BASE_URL, normalizeServerUrl, setApiBaseUrl } from "@/lib/config";
import { rediscover } from "@/lib/discovery";
import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

import { Button, Field } from "./form";

/**
 * « Adresse du serveur » : l'ordinateur qui fait tourner le site Green Trek (même Wi-Fi). Pour
 * l'application installée (APK) le jour de la démonstration : l'adresse de l'ordinateur change
 * d'un réseau à l'autre. L'adresse est testée (catalogue) avant d'être enregistrée.
 */
export function ServerSettings() {
  const s = useStyles();
  const { theme } = useTheme();
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
        text: `Connecté à ${apiBaseUrl()} : ${agences.length} agence${agences.length > 1 ? "s" : ""}.`,
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

  async function search() {
    setPending(true);
    setStatus(null);
    const found = await rediscover().catch(() => null);
    setPending(false);
    if (found) {
      setValue(found);
      setStatus({ ok: true, text: `Serveur trouvé : ${found}.` });
    } else {
      setStatus({
        ok: false,
        text: "Aucun serveur Green Trek trouvé sur ce réseau. Le site est-il démarré, et l'ordinateur sur le même Wi-Fi (ou connecté au partage de connexion de ce téléphone) ?",
      });
    }
  }

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={s.icon}>
          <Ionicons name="server-outline" size={18} color={theme.accent} />
        </View>
        <Text style={s.title}>Adresse du serveur</Text>
      </View>
      <Text style={s.small}>
        Ordinateur qui fait tourner le site Green Trek, sur le même Wi-Fi que ce téléphone ou
        connecté à son partage de connexion. L&apos;application la retrouve toute seule quand elle
        change ; ce réglage ne sert qu&apos;en dernier recours.
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
          style={[s.status, { color: status.ok ? theme.success : theme.danger }]}
          accessibilityLiveRegion="polite"
        >
          {status.text}
        </Text>
      ) : null}
      <Button
        label={pending ? "Recherche…" : "Rechercher automatiquement"}
        pending={pending}
        onPress={() => void search()}
      />
      <Button
        label={pending ? "Test…" : "Tester et enregistrer"}
        variant="secondary"
        pending={pending}
        onPress={() => void save(value)}
      />
      {apiBaseUrl() !== DEFAULT_API_BASE_URL ? (
        <Button label="Adresse par défaut" variant="secondary" onPress={() => void save(null)} />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    card: { backgroundColor: t.surface, borderRadius: radius.md, padding: 16, gap: 12 },
    head: { flexDirection: "row", alignItems: "center", gap: 10 },
    icon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: t.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontFamily: fonts.textSemiBold, fontSize: 16, color: t.text },
    small: { fontFamily: fonts.text, fontSize: 12, lineHeight: 17, color: t.textMuted },
    status: { fontFamily: fonts.text, fontSize: 13, lineHeight: 18 },
  }),
);
