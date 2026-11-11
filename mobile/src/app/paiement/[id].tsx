import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Field, FormError } from "@/components/form";
import { RequireAuth } from "@/components/require-auth";
import { ScreenHeader } from "@/components/screen-header";
import { ErrorState, Loading } from "@/components/states";
import { useAsync } from "@/hooks/use-async";
import { ApiError, fetchReservation, type MethodePaiement, payReservation } from "@/lib/api";
import { formatDayRange, formatMoney } from "@/lib/format";
import { makeStyles, useTheme } from "@/theme/theme";
import { colors, fonts, radius } from "@/theme/tokens";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Moyens de paiement, mêmes règles que le site (étape E9). */
const METHODES: {
  key: MethodePaiement;
  label: string;
  text: string;
  icon: IconName;
  chiffres?: number;
}[] = [
  {
    key: "MOBILE_MONEY",
    label: "Mobile Money",
    text: "Paiement immédiat, réservation confirmée.",
    icon: "phone-portrait-outline",
    chiffres: 10,
  },
  {
    key: "CARTE_SIMULEE",
    label: "Carte bancaire",
    text: "Paiement immédiat, réservation confirmée.",
    icon: "card-outline",
    chiffres: 16,
  },
  {
    key: "VIREMENT",
    label: "Virement bancaire",
    text: "L'agence confirme à réception du virement.",
    icon: "business-outline",
  },
  {
    key: "ESPECES",
    label: "Espèces à l'agence",
    text: "Réglez à l'agence ; elle confirme à réception.",
    icon: "cash-outline",
  },
];

/** Paiement du reste à payer d'une réservation ; succès : fiche de la réservation. */
export default function PaiementScreen() {
  return (
    <RequireAuth>
      <Paiement />
    </RequireAuth>
  );
}

function Paiement() {
  const styles = useStyles();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: r, error, reload } = useAsync(() => fetchReservation(id), id);
  const [methode, setMethode] = useState<MethodePaiement>("MOBILE_MONEY");
  const [numero, setNumero] = useState("");
  const [numeroError, setNumeroError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!r) return <Loading />;
  const choix = METHODES.find((m) => m.key === methode)!;

  async function pay() {
    const chiffres = numero.replace(/\s+/g, "");
    if (choix.chiffres && !new RegExp(`^\\d{${choix.chiffres}}$`).test(chiffres)) {
      return setNumeroError(`${choix.chiffres} chiffres attendus.`);
    }
    setNumeroError(undefined);
    setFormError(null);
    setPending(true);
    try {
      await payReservation(id, { methode, numero: chiffres });
      router.replace({ pathname: "/reservation/[id]", params: { id, paye: "1" } });
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        setNumeroError(e.fieldErrors.numero);
        setFormError(e.message);
      } else setFormError("Paiement impossible.");
    } finally {
      setPending(false);
    }
  }

  if (!r.peutPayer) {
    return (
      <View style={styles.screen}>
        <ScreenHeader kicker="Paiement" title={r.circuit.titre} />
        <View style={styles.content}>
          <Text style={styles.paragraph}>
            {r.reste === 0
              ? "Cette réservation est déjà entièrement payée."
              : "Un paiement est en attente de validation par l'agence, ou la réservation n'est plus payable."}
          </Text>
          <Button
            label="Voir la réservation"
            onPress={() => router.replace({ pathname: "/reservation/[id]", params: { id } })}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.screen}>
        <ScreenHeader kicker="Paiement" title={r.circuit.titre} />
        <KeyboardAwareScrollView
          bottomOffset={24}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.amount}>
            <Text style={styles.amountLabel}>À payer</Text>
            <Text style={styles.amountValue}>{formatMoney(r.reste, r.agence.devise)}</Text>
            <Text style={styles.amountMeta}>
              {r.reference} · {formatDayRange(r.depart.dateDebut, r.depart.dateFin)} ·{" "}
              {r.nombrePersonnes} pers.
            </Text>
          </View>

          <Text style={styles.h2}>Moyen de paiement</Text>
          <View style={{ gap: 10 }} accessibilityRole="radiogroup">
            {METHODES.map((m) => {
              const on = m.key === methode;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => {
                    setMethode(m.key);
                    setNumeroError(undefined);
                  }}
                  style={[styles.option, on && styles.optionOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                >
                  <Ionicons name={m.icon} size={22} color={on ? theme.onPrimary : theme.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>{m.label}</Text>
                    <Text style={[styles.optionText, on && styles.optionTextOn]}>{m.text}</Text>
                  </View>
                  <Ionicons
                    name={on ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={on ? theme.onPrimary : theme.border}
                  />
                </Pressable>
              );
            })}
          </View>

          <FormError message={formError} />

          {choix.chiffres ? (
            <Field
              label={methode === "CARTE_SIMULEE" ? "Numéro de carte" : "Numéro Mobile Money"}
              value={numero}
              onChangeText={setNumero}
              keyboardType="number-pad"
              maxLength={choix.chiffres}
              error={numeroError}
              hint={`${choix.chiffres} chiffres.`}
              autoComplete={methode === "CARTE_SIMULEE" ? "cc-number" : "tel"}
            />
          ) : null}

          <Button
            label={pending ? "Paiement…" : `Payer ${formatMoney(r.reste, r.agence.devise)}`}
            pending={pending}
            onPress={() => void pay()}
          />
          <Button
            label="Payer plus tard"
            variant="secondary"
            onPress={() => router.replace({ pathname: "/reservation/[id]", params: { id } })}
          />
        </KeyboardAwareScrollView>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 18, gap: 14 },
    paragraph: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: t.textMuted },
    h2: { fontFamily: fonts.display, fontSize: 18, color: t.text, marginTop: 4 },
    amount: {
      backgroundColor: colors.teal900,
      borderRadius: radius.lg,
      padding: 20,
      gap: 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
    },
    amountLabel: { fontFamily: fonts.script, fontSize: 22, color: colors.sand300 },
    amountValue: { fontFamily: fonts.display, fontSize: 34, color: colors.white },
    amountMeta: { fontFamily: fonts.text, fontSize: 12, color: "rgba(255,255,255,0.85)" },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: t.surface,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: t.border,
      padding: 14,
    },
    optionOn: { backgroundColor: t.primary, borderColor: t.primary },
    optionLabel: { fontFamily: fonts.textSemiBold, fontSize: 15, color: t.text },
    optionLabelOn: { color: t.onPrimary },
    optionText: { fontFamily: fonts.text, fontSize: 12, color: t.textMuted },
    optionTextOn: { color: "rgba(255,255,255,0.85)" },
  }),
);
