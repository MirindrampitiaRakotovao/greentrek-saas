import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CircuitMap } from "@/components/circuit-map";
import { Button, Field, FormError } from "@/components/form";
import { GlassIconButton } from "@/components/glass";
import { ErrorState, Loading } from "@/components/states";
import { useActivity } from "@/context/activity";
import { useAsync } from "@/hooks/use-async";
import { answerItineraire, ApiError, fetchItineraire } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

const km = (v: number) => `${v.toFixed(1).replace(".", ",")} km`;
const duree = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;

/**
 * Fiche d'un itinéraire sur mesure : carte (étapes et tracé), chiffres, message de l'agence,
 * étapes, et réponse (accepter / décliner) quand l'agence attend la décision du voyageur.
 */
export default function ItineraireScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { theme } = useTheme();
  const { refresh } = useActivity();
  const { data: it, error, reload } = useAsync(() => fetchItineraire(id), id);
  const [reponse, setReponse] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const back = (
    <View style={[s.back, { top: insets.top + 8 }]}>
      <GlassIconButton
        icon="chevron-back"
        label="Retour"
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/itineraires"))}
      />
    </View>
  );

  if (error || !it) {
    return (
      <View style={[s.screen, { paddingTop: insets.top + 60 }]}>
        {back}
        {error ? <ErrorState message={error} onRetry={reload} /> : <Loading />}
      </View>
    );
  }

  async function answer(decision: "ACCEPTE" | "DECLINE") {
    setPending(true);
    setFormError(null);
    try {
      setNotice((await answerItineraire(id, { decision, reponse })).message);
      reload();
      refresh();
    } catch (e: unknown) {
      setFormError(e instanceof ApiError ? e.message : "Réponse impossible.");
    } finally {
      setPending(false);
    }
  }

  const steps = it.etapes.map((e, i) => ({
    ordre: i + 1,
    nom: e.nom,
    latitude: e.latitude,
    longitude: e.longitude,
  }));

  return (
    <View style={s.screen}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <View style={{ height: 380 }}>
          <CircuitMap
            steps={steps}
            trace={it.etapes.map((e) => [e.latitude, e.longitude] as const)}
            interactive={false}
            labels
            padBottom={20}
          />
        </View>
        <View style={s.content}>
          <Text style={s.kicker}>
            {it.origine === "AGENCE" ? `Proposé par ${it.auteur}` : "Votre demande"} ·{" "}
            {formatDateTime(it.createdAt)}
          </Text>
          <Text style={s.title} accessibilityRole="header">
            {it.titre}
          </Text>
          <View style={[s.pill, { backgroundColor: theme.accentSoft }]}>
            <Text style={s.pillText}>{it.statutLabel}</Text>
          </View>

          <View style={s.stats}>
            <Stat label="Distance" value={km(it.distanceKm)} />
            <Stat label="Marche" value={duree(it.dureeMinutes)} />
            <Stat label="Critère" value={it.critere} />
          </View>

          {it.message ? (
            <View style={s.card}>
              <Text style={s.h2}>Message de l&apos;agence</Text>
              <Text style={s.paragraph}>« {it.message} »</Text>
            </View>
          ) : null}

          <View style={s.card}>
            <Text style={s.h2}>Étapes</Text>
            {it.etapes.map((e, i) => (
              <View key={`${e.id}-${i}`} style={s.step}>
                <View style={s.stepDot}>
                  <Text style={s.stepNum}>{i + 1}</Text>
                </View>
                <Text style={s.stepName}>{e.nom}</Text>
              </View>
            ))}
          </View>

          {notice ? <Text style={s.notice}>{notice}</Text> : null}
          {it.peutRepondre ? (
            <View style={s.card}>
              <Text style={s.h2}>Votre réponse</Text>
              <Field
                label="Un mot pour l'agence (facultatif)"
                value={reponse}
                onChangeText={setReponse}
                multiline
                maxLength={1000}
                style={{ minHeight: 80, textAlignVertical: "top" }}
              />
              <FormError message={formError} />
              <Button
                label="Accepter cet itinéraire"
                pending={pending}
                onPress={() => void answer("ACCEPTE")}
              />
              <Button
                label="Décliner"
                variant="secondary"
                disabled={pending}
                onPress={() => void answer("DECLINE")}
              />
            </View>
          ) : it.reponduAt ? (
            <View style={s.card}>
              <Text style={s.h2}>Votre réponse</Text>
              <Text style={s.paragraph}>
                {it.statutLabel} le {formatDateTime(it.reponduAt)}
                {it.reponse ? ` : « ${it.reponse} »` : "."}
              </Text>
            </View>
          ) : null}
          <Button
            label="Écrire à l'agence"
            variant="secondary"
            icon="chatbubbles-outline"
            onPress={() => router.push("/messages/nouveau")}
          />
        </View>
      </KeyboardAwareScrollView>
      {back}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const s = useStyles();
  return (
    <View style={s.stat}>
      <Text style={s.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    back: { position: "absolute", left: 16 },
    content: { padding: 18, gap: 12 },
    kicker: { fontFamily: fonts.textMedium, fontSize: 12, color: t.textMuted },
    title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, color: t.text },
    pill: {
      alignSelf: "flex-start",
      borderRadius: radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    pillText: { fontFamily: fonts.textSemiBold, fontSize: 12, color: t.text },
    stats: { flexDirection: "row", gap: 8 },
    stat: {
      flex: 1,
      backgroundColor: t.surface,
      borderRadius: radius.md,
      padding: 12,
      gap: 2,
    },
    statValue: { fontFamily: fonts.textSemiBold, fontSize: 15, color: t.text },
    statLabel: { fontFamily: fonts.text, fontSize: 11, color: t.textMuted },
    card: { backgroundColor: t.surface, borderRadius: radius.md, padding: 16, gap: 10 },
    h2: { fontFamily: fonts.display, fontSize: 18, color: t.text },
    paragraph: { fontFamily: fonts.text, fontSize: 14, lineHeight: 21, color: t.textMuted },
    notice: { fontFamily: fonts.textMedium, fontSize: 14, color: t.success },
    step: { flexDirection: "row", alignItems: "center", gap: 10 },
    stepDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: t.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    stepNum: { fontFamily: fonts.textSemiBold, fontSize: 11, color: t.onPrimary },
    stepName: { fontFamily: fonts.textMedium, fontSize: 14, color: t.text },
  }),
);
