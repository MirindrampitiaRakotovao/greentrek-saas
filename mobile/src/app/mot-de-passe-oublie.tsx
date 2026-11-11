import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { AgencyPicker } from "@/components/agency-picker";
import { AuthScreen } from "@/components/auth-screen";
import { Button, Field, FormError } from "@/components/form";
import { Loading } from "@/components/states";
import { useAsync } from "@/hooks/use-async";
import { ApiError, fetchCatalogue, forgotPassword } from "@/lib/api";
import { useTheme } from "@/theme/theme";
import { fonts } from "@/theme/tokens";

/**
 * Mot de passe oublié : l'e-mail contient un lien vers la page de réinitialisation du site de
 * l'agence (même parcours que sur le site). Réponse identique que le compte existe ou non.
 */
export default function MotDePasseOublieScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ agence?: string }>();
  const { data } = useAsync(() => fetchCatalogue(), "agences");
  const [agence, setAgence] = useState(params.agence ?? "");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!agence) return setError("Choisissez l'agence de votre compte.");
    setError(null);
    setPending(true);
    try {
      setSent((await forgotPassword({ email: email.trim(), agenceSlug: agence })).message);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Envoi impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScreen
      active="connexion"
      title="Mot de passe oublié ?"
      subtitle="Nous vous envoyons un lien pour choisir un nouveau mot de passe."
      onSwitch={() => router.replace({ pathname: "/inscription", params })}
    >
      {sent ? (
        <>
          <Text style={[styles.sent, { color: theme.text }]} accessibilityLiveRegion="polite">
            {sent}
          </Text>
          <Button
            label="Retour à la connexion"
            onPress={() => router.replace({ pathname: "/connexion", params })}
          />
        </>
      ) : (
        <>
          {data ? (
            <AgencyPicker agences={data.agences} value={agence} onChange={setAgence} />
          ) : (
            <Loading label="Chargement des agences…" />
          )}
          <FormError message={error} />
          <Field
            label="Adresse e-mail du compte"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            onGlass
          />
          <Button
            label={pending ? "Envoi…" : "Recevoir le lien par e-mail"}
            pending={pending}
            onPress={() => void submit()}
          />
        </>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  sent: { fontFamily: fonts.text, fontSize: 14, lineHeight: 21 },
});
