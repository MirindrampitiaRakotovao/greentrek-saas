import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { AgencyPicker } from "@/components/agency-picker";
import { AuthScreen } from "@/components/auth-screen";
import { Button, Field, FormError, PasswordField } from "@/components/form";
import { Loading } from "@/components/states";
import { useAuth } from "@/context/auth";
import { useAsync } from "@/hooks/use-async";
import { ApiError, fetchCatalogue } from "@/lib/api";

const EMPTY = { prenom: "", nom: "", email: "", telephone: "", password: "", confirmPassword: "" };

/** Création d'un compte voyageur auprès d'une agence (règles vérifiées par le serveur). */
export default function InscriptionScreen() {
  const params = useLocalSearchParams<{ agence?: string }>();
  const { register } = useAuth();
  const { data } = useAsync(() => fetchCatalogue(), "agences");
  const [agence, setAgence] = useState(params.agence ?? "");
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    if (!agence) return setError("Choisissez l'agence auprès de laquelle créer votre compte.");
    setError(null);
    setErrors({});
    setPending(true);
    try {
      await register({ ...form, email: form.email.trim(), agenceSlug: agence });
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors);
        setError(e.message);
      } else setError("Inscription impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScreen
      active="inscription"
      title="Commencez l'aventure"
      subtitle="Votre compte voyageur vous permet de réserver et de suivre vos voyages."
      onSwitch={() => router.replace({ pathname: "/connexion", params })}
    >
      {data ? (
        <AgencyPicker agences={data.agences} value={agence} onChange={setAgence} />
      ) : (
        <Loading label="Chargement des agences…" />
      )}
      <FormError message={error} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Prénom"
            value={form.prenom}
            onChangeText={set("prenom")}
            error={errors.prenom}
            autoComplete="given-name"
            onGlass
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Nom"
            value={form.nom}
            onChangeText={set("nom")}
            error={errors.nom}
            autoComplete="family-name"
            onGlass
          />
        </View>
      </View>
      <Field
        label="Adresse e-mail"
        value={form.email}
        onChangeText={set("email")}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        onGlass
      />
      <Field
        label="Téléphone (facultatif)"
        value={form.telephone}
        onChangeText={set("telephone")}
        error={errors.telephone}
        keyboardType="phone-pad"
        autoComplete="tel"
        onGlass
      />
      <PasswordField
        label="Mot de passe"
        value={form.password}
        onChangeText={set("password")}
        error={errors.password}
        hint="8 caractères au moins, avec une majuscule, une minuscule et un chiffre."
        autoComplete="new-password"
        onGlass
      />
      <PasswordField
        label="Confirmer le mot de passe"
        value={form.confirmPassword}
        onChangeText={set("confirmPassword")}
        error={errors.confirmPassword}
        autoComplete="new-password"
        onGlass
      />
      <Button
        label={pending ? "Création du compte…" : "Créer mon compte"}
        pending={pending}
        onPress={() => void submit()}
      />
    </AuthScreen>
  );
}
