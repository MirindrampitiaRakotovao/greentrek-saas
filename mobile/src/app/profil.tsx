import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Field, FormError, PasswordField } from "@/components/form";
import { PhotoEditor } from "@/components/photo-editor";
import { RequireAuth } from "@/components/require-auth";
import { ScreenHeader } from "@/components/screen-header";
import { useAuth } from "@/context/auth";
import { ApiError, changePassword, updateProfile } from "@/lib/api";
import { makeStyles } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

export default function ProfilScreen() {
  return (
    <RequireAuth>
      <Profil />
    </RequireAuth>
  );
}

/** Mon profil : prénom, nom, téléphone, et changement du mot de passe (mêmes règles que le site). */
function Profil() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    prenom: user!.prenom,
    nom: user!.nom,
    telephone: user!.telephone ?? "",
  });
  const [pwd, setPwd] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pwdErrors, setPwdErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwdMessage, setPwdMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState<"profil" | "pwd" | null>(null);

  async function saveProfile() {
    setPending("profil");
    setErrors({});
    setMessage(null);
    try {
      await updateUser(await updateProfile(form));
      setMessage({ ok: true, text: "Profil enregistré." });
    } catch (e: unknown) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      setMessage({
        ok: false,
        text: e instanceof ApiError ? e.message : "Enregistrement impossible.",
      });
    } finally {
      setPending(null);
    }
  }

  async function savePassword() {
    setPending("pwd");
    setPwdErrors({});
    setPwdMessage(null);
    try {
      const res = await changePassword(pwd);
      setPwd({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPwdMessage({ ok: true, text: res.message });
    } catch (e: unknown) {
      if (e instanceof ApiError) setPwdErrors(e.fieldErrors);
      setPwdMessage({
        ok: false,
        text: e instanceof ApiError ? e.message : "Modification impossible.",
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.screen}>
        <ScreenHeader kicker="Votre compte" title="Mon profil" />
        <KeyboardAwareScrollView
          bottomOffset={24}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <PhotoEditor />
          <View style={styles.card}>
            <Text style={styles.h2}>Coordonnées</Text>
            <Text style={styles.small}>
              {user!.email} · {user!.agenceNom}
            </Text>
            <Field
              label="Prénom"
              value={form.prenom}
              onChangeText={(v) => setForm((f) => ({ ...f, prenom: v }))}
              error={errors.prenom}
            />
            <Field
              label="Nom"
              value={form.nom}
              onChangeText={(v) => setForm((f) => ({ ...f, nom: v }))}
              error={errors.nom}
            />
            <Field
              label="Téléphone (facultatif)"
              value={form.telephone}
              onChangeText={(v) => setForm((f) => ({ ...f, telephone: v }))}
              keyboardType="phone-pad"
              error={errors.telephone}
            />
            {message && !message.ok ? <FormError message={message.text} /> : null}
            {message?.ok ? <Text style={styles.success}>{message.text}</Text> : null}
            <Button
              label={pending === "profil" ? "Enregistrement…" : "Enregistrer"}
              pending={pending === "profil"}
              onPress={() => void saveProfile()}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.h2}>Mot de passe</Text>
            <PasswordField
              label="Mot de passe actuel"
              value={pwd.currentPassword}
              onChangeText={(v) => setPwd((p) => ({ ...p, currentPassword: v }))}
              error={pwdErrors.currentPassword}
              autoComplete="current-password"
            />
            <PasswordField
              label="Nouveau mot de passe"
              value={pwd.newPassword}
              onChangeText={(v) => setPwd((p) => ({ ...p, newPassword: v }))}
              error={pwdErrors.newPassword}
              hint="8 caractères au moins, avec une majuscule, une minuscule et un chiffre."
              autoComplete="new-password"
            />
            <PasswordField
              label="Confirmer le mot de passe"
              value={pwd.confirmPassword}
              onChangeText={(v) => setPwd((p) => ({ ...p, confirmPassword: v }))}
              error={pwdErrors.confirmPassword}
              autoComplete="new-password"
            />
            {pwdMessage && !pwdMessage.ok ? <FormError message={pwdMessage.text} /> : null}
            {pwdMessage?.ok ? <Text style={styles.success}>{pwdMessage.text}</Text> : null}
            <Button
              label={pending === "pwd" ? "Modification…" : "Changer le mot de passe"}
              pending={pending === "pwd"}
              variant="secondary"
              onPress={() => void savePassword()}
            />
          </View>
        </KeyboardAwareScrollView>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 18, gap: 14 },
    card: { backgroundColor: t.surface, borderRadius: radius.md, padding: 16, gap: 12 },
    h2: { fontFamily: fonts.display, fontSize: 18, color: t.text },
    small: { fontFamily: fonts.text, fontSize: 12, color: t.textMuted },
    success: { fontFamily: fonts.textMedium, fontSize: 13, color: t.accent },
  }),
);
