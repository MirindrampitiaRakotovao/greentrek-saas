import Ionicons from "@expo/vector-icons/Ionicons";
import { type ComponentProps, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";

import { colors, fonts, radius } from "@/theme/tokens";

type FieldProps = ComponentProps<typeof TextInput> & {
  label: string;
  error?: string;
  hint?: string;
  /** Élément placé à droite dans le champ (ex. bouton « afficher le mot de passe »). */
  trailing?: React.ReactNode;
};

/** Champ à libellé posé dans la bordure (même style que la connexion du site). */
export function Field({ label, error, hint, trailing, style, ...props }: FieldProps) {
  return (
    <View style={styles.field}>
      <View style={[styles.box, error ? styles.boxError : null]}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          {...props}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={colors.muted}
          style={[styles.input, style]}
        />
        {trailing}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** Mot de passe avec un bouton « œil » pour l'afficher ou le masquer. */
export function PasswordField(props: Omit<FieldProps, "secureTextEntry" | "trailing">) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      trailing={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          style={styles.eye}
          accessibilityRole="button"
          accessibilityLabel={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={colors.muted}
          />
        </Pressable>
      }
    />
  );
}

/** Bouton principal (plein) ou secondaire (contour), avec état d'attente. */
export function Button({
  label,
  onPress,
  pending = false,
  variant = "primary",
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  pending?: boolean;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const v = variants[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={pending || disabled}
      style={({ pressed }) => [
        styles.button,
        v.button,
        (pending || disabled) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ busy: pending, disabled: pending || disabled }}
    >
      {pending ? <ActivityIndicator color={v.text.color} /> : null}
      <Text style={[styles.buttonText, v.text]}>{label}</Text>
    </Pressable>
  );
}

/** Message d'erreur général d'un formulaire. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.alert} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={18} color={colors.danger} />
      <Text style={styles.alertText}>{message}</Text>
    </View>
  );
}

const variants = {
  primary: { button: { backgroundColor: colors.teal900 }, text: { color: colors.white } },
  secondary: {
    button: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.teal900 },
    text: { color: colors.teal900 },
  },
  danger: {
    button: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.danger },
    text: { color: colors.danger },
  },
} as const;

const styles = StyleSheet.create({
  field: { gap: 4 },
  box: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(150, 190, 202, 0.8)",
    borderRadius: radius.sm + 2,
    backgroundColor: colors.white,
    minHeight: 56,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  boxError: { borderColor: colors.danger },
  label: {
    position: "absolute",
    top: -10,
    left: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.white,
    fontFamily: fonts.text,
    fontSize: 12,
    color: colors.muted,
  },
  input: {
    flex: 1,
    fontFamily: fonts.text,
    fontSize: 15,
    color: colors.teal900,
    paddingVertical: 14,
  },
  eye: { padding: 6 },
  error: { fontFamily: fonts.text, fontSize: 12, color: colors.danger },
  hint: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  button: {
    minHeight: 54,
    borderRadius: radius.sm + 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
  },
  buttonText: { fontFamily: fonts.textSemiBold, fontSize: 15 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
  alert: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: "#FEF3F2",
    borderRadius: radius.sm,
    padding: 12,
  },
  alertText: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: colors.danger },
});
