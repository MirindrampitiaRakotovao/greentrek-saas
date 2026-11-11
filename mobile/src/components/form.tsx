import Ionicons from "@expo/vector-icons/Ionicons";
import { type ComponentProps, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";

import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

type FieldProps = ComponentProps<typeof TextInput> & {
  label: string;
  error?: string;
  hint?: string;
  /** Élément placé à droite dans le champ (ex. bouton « afficher le mot de passe »). */
  trailing?: React.ReactNode;
  /** Champ posé sur une photo ou du verre : fond translucide. */
  onGlass?: boolean;
};

/** Champ : libellé au-dessus, zone de saisie arrondie sans bordure (style iOS). */
export function Field({ label, error, hint, trailing, onGlass, style, ...props }: FieldProps) {
  const s = useStyles();
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View
        style={[s.box, onGlass && s.boxGlass, focused && s.boxFocused, error ? s.boxError : null]}
      >
        <TextInput
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={theme.textMuted}
          selectionColor={theme.accent}
          style={[s.input, style]}
        />
        {trailing}
      </View>
      {error ? (
        <Text style={s.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={s.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** Mot de passe avec un bouton « œil » pour l'afficher ou le masquer. */
export function PasswordField(props: Omit<FieldProps, "secureTextEntry" | "trailing">) {
  const [visible, setVisible] = useState(false);
  const { theme } = useTheme();
  return (
    <Field
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      trailing={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          style={{ padding: 6 }}
          accessibilityRole="button"
          accessibilityLabel={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={theme.textMuted}
          />
        </Pressable>
      }
    />
  );
}

/** Bouton : principal (plein), secondaire (teinté), danger, avec état d'attente. */
export function Button({
  label,
  onPress,
  pending = false,
  variant = "primary",
  disabled = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  pending?: boolean;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  style?: StyleProp<ViewStyle>;
}) {
  const s = useStyles();
  const { theme } = useTheme();
  const v = {
    primary: { box: s.primary, color: theme.onPrimary },
    secondary: { box: s.secondary, color: theme.text },
    danger: { box: s.dangerButton, color: theme.danger },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={pending || disabled}
      style={({ pressed }) => [
        s.button,
        v.box,
        (pending || disabled) && s.disabled,
        pressed && s.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ busy: pending, disabled: pending || disabled }}
    >
      {pending ? (
        <ActivityIndicator color={v.color} />
      ) : icon ? (
        <Ionicons name={icon} size={18} color={v.color} />
      ) : null}
      <Text style={[s.buttonText, { color: v.color }]}>{label}</Text>
    </Pressable>
  );
}

/** Message d'erreur général d'un formulaire. */
export function FormError({ message }: { message: string | null }) {
  const s = useStyles();
  const { theme } = useTheme();
  if (!message) return null;
  return (
    <View style={s.alert} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={18} color={theme.danger} />
      <Text style={s.alertText}>{message}</Text>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    field: { gap: 6 },
    label: { fontFamily: fonts.textMedium, fontSize: 13, color: t.text, marginLeft: 4 },
    box: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: radius.sm + 4,
      backgroundColor: t.surfaceAlt,
      minHeight: 54,
      paddingHorizontal: 16,
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    boxGlass: {
      backgroundColor: t.dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
    },
    boxFocused: { borderColor: t.accent },
    boxError: { borderColor: t.danger },
    input: {
      flex: 1,
      fontFamily: fonts.text,
      fontSize: 15,
      color: t.text,
      paddingVertical: 14,
    },
    error: { fontFamily: fonts.text, fontSize: 12, color: t.danger, marginLeft: 4 },
    hint: { fontFamily: fonts.text, fontSize: 12, color: t.textMuted, marginLeft: 4 },
    button: {
      minHeight: 54,
      borderRadius: radius.pill,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 22,
    },
    primary: { backgroundColor: t.primary },
    secondary: { backgroundColor: t.accentSoft },
    dangerButton: { backgroundColor: t.dangerSoft },
    buttonText: { fontFamily: fonts.textSemiBold, fontSize: 15 },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
    alert: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
      backgroundColor: t.dangerSoft,
      borderRadius: radius.sm,
      padding: 12,
    },
    alertText: { flex: 1, fontFamily: fonts.text, fontSize: 13, color: t.danger },
  }),
);
