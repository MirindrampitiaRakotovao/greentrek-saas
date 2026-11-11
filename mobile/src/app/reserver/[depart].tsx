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
import { useAuth } from "@/context/auth";
import { useAsync } from "@/hooks/use-async";
import { ApiError, createReservation, fetchCircuit, type ParticipantInput } from "@/lib/api";
import { formatDayRange, formatMoney, formatPlaces } from "@/lib/format";
import { colors, fonts, radius } from "@/theme/tokens";

const ETAPES = ["Voyageurs", "Participants", "Récapitulatif"] as const;
const MAX_PAR_RESERVATION = 20;

const vide = (prenom = "", nom = ""): ParticipantInput => ({
  prenom,
  nom,
  age: "",
  nationalite: "",
  contactUrgence: "",
});

/**
 * Réservation d'un départ, en trois étapes comme sur le site : nombre de voyageurs,
 * participants (le premier est le voyageur connecté), récapitulatif. Le serveur refait toutes
 * les vérifications (places restantes sous verrou, montant figé) ; le montant affiché ici
 * n'est qu'indicatif.
 */
export default function ReserverScreen() {
  return (
    <RequireAuth>
      <Reserver />
    </RequireAuth>
  );
}

function Reserver() {
  const {
    depart: departId,
    agence,
    circuit: circuitSlug,
  } = useLocalSearchParams<{
    depart: string;
    agence: string;
    circuit: string;
  }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    data: circuit,
    error,
    reload,
  } = useAsync(() => fetchCircuit(agence, circuitSlug), `${agence}/${circuitSlug}`);
  const [step, setStep] = useState(0);
  const [nombre, setNombre] = useState(1);
  const [participants, setParticipants] = useState<ParticipantInput[]>([]);
  const [remarques, setRemarques] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!circuit || !user) return <Loading />; // `user` : garanti par RequireAuth
  const depart = circuit.departs.find((d) => d.id === departId);
  if (!depart) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Départ indisponible" />
        <Text style={[styles.paragraph, { padding: 18 }]}>
          Ce départ n’est plus ouvert à la réservation (complet ou trop proche). Choisissez une
          autre date sur la fiche du circuit.
        </Text>
      </View>
    );
  }
  const max = Math.min(depart.placesLibres, MAX_PAR_RESERVATION);

  function toParticipants() {
    // Conserve les saisies déjà faites ; le premier voyageur est le titulaire du compte.
    setParticipants((prev) =>
      Array.from(
        { length: nombre },
        (_, i) => prev[i] ?? (i === 0 ? vide(user!.prenom, user!.nom) : vide()),
      ),
    );
    setStep(1);
  }

  function checkParticipants(): boolean {
    const e: Record<string, string> = {};
    participants.forEach((p, i) => {
      if (!p.prenom.trim()) e[`participants.${i}.prenom`] = "Prénom requis.";
      if (!p.nom.trim()) e[`participants.${i}.nom`] = "Nom requis.";
      if (p.age && !/^\d{1,3}$/.test(p.age.trim())) e[`participants.${i}.age`] = "Âge invalide.";
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function confirm() {
    setFormError(null);
    setPending(true);
    try {
      const r = await createReservation({ sessionId: depart!.id, participants, remarques });
      router.replace({ pathname: "/paiement/[id]", params: { id: r.id } });
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors);
        setFormError(e.message);
        if (Object.keys(e.fieldErrors).some((k) => k.startsWith("participants."))) setStep(1);
      } else setFormError("Réservation impossible.");
    } finally {
      setPending(false);
    }
  }

  const update = (i: number, key: keyof ParticipantInput) => (value: string) => {
    setParticipants((list) => list.map((p, j) => (j === i ? { ...p, [key]: value } : p)));
    // L'erreur de ce champ disparaît dès qu'on le corrige.
    setErrors(({ [`participants.${i}.${key}`]: _corrige, ...rest }) => rest);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.screen}>
        <ScreenHeader kicker="Réservation" title={circuit.titre} />
        <KeyboardAwareScrollView
          bottomOffset={24}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.summary}>
            <Text style={styles.summaryDate}>
              {formatDayRange(depart.dateDebut, depart.dateFin)}
            </Text>
            <Text style={styles.paragraph}>
              {circuit.agence.nom} · {formatPlaces(depart.placesLibres)} ·{" "}
              {formatMoney(depart.prix, circuit.agence.devise)} / pers.
            </Text>
          </View>

          <View
            style={styles.stepper}
            accessibilityRole="progressbar"
            accessibilityLabel={`Étape ${step + 1} sur 3 : ${ETAPES[step]}`}
          >
            {ETAPES.map((label, i) => (
              <View key={label} style={styles.stepItem}>
                <View style={[styles.stepDot, i <= step && styles.stepDotOn]}>
                  {i < step ? (
                    <Ionicons name="checkmark" size={14} color={colors.white} />
                  ) : (
                    <Text style={[styles.stepNum, i <= step && styles.stepNumOn]}>{i + 1}</Text>
                  )}
                </View>
                <Text style={[styles.stepLabel, i === step && styles.stepLabelOn]}>{label}</Text>
              </View>
            ))}
          </View>

          <FormError message={formError} />

          {step === 0 ? (
            <View style={styles.card}>
              <Text style={styles.h2}>Combien de voyageurs ?</Text>
              <View style={styles.counter}>
                <Pressable
                  onPress={() => setNombre((n) => Math.max(1, n - 1))}
                  style={styles.counterBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Un voyageur de moins"
                >
                  <Ionicons name="remove" size={22} color={colors.teal900} />
                </Pressable>
                <Text style={styles.counterValue} accessibilityLiveRegion="polite">
                  {nombre}
                </Text>
                <Pressable
                  onPress={() => setNombre((n) => Math.min(max, n + 1))}
                  style={styles.counterBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Un voyageur de plus"
                >
                  <Ionicons name="add" size={22} color={colors.teal900} />
                </Pressable>
              </View>
              <Text style={styles.paragraph}>
                {max} au plus pour ce départ. Total indicatif :{" "}
                {formatMoney(depart.prix * nombre, circuit.agence.devise)}
              </Text>
              <Button label="Continuer" onPress={toParticipants} />
            </View>
          ) : null}

          {step === 1 ? (
            <>
              {participants.map((p, i) => (
                <View key={i} style={styles.card}>
                  <Text style={styles.h2}>{i === 0 ? "Vous" : `Voyageur ${i + 1}`}</Text>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Prénom"
                        value={p.prenom}
                        onChangeText={update(i, "prenom")}
                        error={errors[`participants.${i}.prenom`]}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Nom"
                        value={p.nom}
                        onChangeText={update(i, "nom")}
                        error={errors[`participants.${i}.nom`]}
                      />
                    </View>
                  </View>
                  <View style={styles.row}>
                    <View style={{ width: 110 }}>
                      <Field
                        label="Âge"
                        value={p.age}
                        onChangeText={update(i, "age")}
                        keyboardType="number-pad"
                        error={errors[`participants.${i}.age`]}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Nationalité"
                        value={p.nationalite}
                        onChangeText={update(i, "nationalite")}
                      />
                    </View>
                  </View>
                </View>
              ))}
              <Button label="Continuer" onPress={() => checkParticipants() && setStep(2)} />
              <Button label="Retour" variant="secondary" onPress={() => setStep(0)} />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <View style={styles.card}>
                <Text style={styles.h2}>Récapitulatif</Text>
                {participants.map((p, i) => (
                  <Text key={i} style={styles.paragraph}>
                    {i + 1}. {p.prenom} {p.nom}
                    {p.age ? ` · ${p.age} ans` : ""}
                  </Text>
                ))}
                <View style={styles.total}>
                  <Text style={styles.paragraph}>
                    {participants.length} × {formatMoney(depart.prix, circuit.agence.devise)}
                  </Text>
                  <Text style={styles.totalValue}>
                    {formatMoney(depart.prix * participants.length, circuit.agence.devise)}
                  </Text>
                </View>
                <Text style={styles.small}>
                  Le montant est fixé à la réservation. Vous paierez à l’étape suivante.
                </Text>
              </View>
              <View style={styles.card}>
                <Field
                  label="Remarques pour l'agence (facultatif)"
                  value={remarques}
                  onChangeText={setRemarques}
                  placeholder="Régime alimentaire, besoins particuliers…"
                  multiline
                  style={{ minHeight: 80, textAlignVertical: "top" }}
                />
              </View>
              <Button
                label={pending ? "Réservation…" : "Confirmer la réservation"}
                pending={pending}
                onPress={() => void confirm()}
              />
              <Button label="Retour" variant="secondary" onPress={() => setStep(1)} />
            </>
          ) : null}
        </KeyboardAwareScrollView>
      </View>
    </View>
  );
}

const card = {
  backgroundColor: colors.white,
  borderRadius: radius.md,
  padding: 16,
  gap: 12,
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 18, gap: 14 },
  summary: { ...card, gap: 2 },
  summaryDate: { fontFamily: fonts.textSemiBold, fontSize: 16, color: colors.teal900 },
  paragraph: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.muted },
  small: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  stepper: { flexDirection: "row", justifyContent: "space-between" },
  stepItem: { alignItems: "center", gap: 4, flex: 1 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  stepDotOn: { backgroundColor: colors.teal900, borderColor: colors.teal900 },
  stepNum: { fontFamily: fonts.textSemiBold, fontSize: 12, color: colors.muted },
  stepNumOn: { color: colors.white },
  stepLabel: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  stepLabelOn: { fontFamily: fonts.textSemiBold, color: colors.teal900 },
  card,
  h2: { fontFamily: fonts.display, fontSize: 18, color: colors.teal900 },
  row: { flexDirection: "row", gap: 12 },
  counter: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28 },
  counterBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.teal900,
    alignItems: "center",
    justifyContent: "center",
  },
  counterValue: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.teal900,
    minWidth: 40,
    textAlign: "center",
  },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    borderTopWidth: 1,
    borderTopColor: colors.mist,
    paddingTop: 10,
  },
  totalValue: { fontFamily: fonts.display, fontSize: 22, color: colors.teal900 },
});
