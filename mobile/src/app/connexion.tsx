import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { AgencyPicker } from "@/components/agency-picker";
import { AuthScreen } from "@/components/auth-screen";
import { Button, Field, FormError, PasswordField } from "@/components/form";
import { Loading } from "@/components/states";
import { useAuth } from "@/context/auth";
import { useAsync } from "@/hooks/use-async";
import { ApiError, fetchCatalogue } from "@/lib/api";
import { afterAuth } from "@/lib/navigation";

/**
 * Connexion d'un voyageur. `agence` : agence proposée (celle du circuit à réserver) ;
 * `retour` : écran à rouvrir après la connexion (ex. la réservation en cours).
 */
export default function ConnexionScreen() {
  const params = useLocalSearchParams<{ agence?: string; retour?: string }>();
  const { login } = useAuth();
  const { data } = useAsync(() => fetchCatalogue(), "agences");
  const [agence, setAgence] = useState(params.agence ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!agence) return setError("Choisissez l'agence de votre compte.");
    setError(null);
    setPending(true);
    try {
      await login({ email: email.trim(), password, agenceSlug: agence });
      afterAuth(params.retour);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Connexion impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScreen
      active="connexion"
      title="Bon retour parmi nous"
      subtitle="Connectez-vous pour réserver et suivre vos voyages."
      onSwitch={() => router.replace({ pathname: "/inscription", params })}
    >
      {data ? (
        <AgencyPicker agences={data.agences} value={agence} onChange={setAgence} />
      ) : (
        <Loading label="Chargement des agences…" />
      )}
      <FormError message={error} />
      <Field
        label="Adresse e-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <PasswordField
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => void submit()}
      />
      <Button
        label={pending ? "Connexion…" : "Se connecter"}
        pending={pending}
        onPress={() => void submit()}
      />
    </AuthScreen>
  );
}
