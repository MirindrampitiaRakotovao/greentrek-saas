import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CircuitMap } from "@/components/circuit-map";
import { Button, Field, FormError } from "@/components/form";
import { Segmented } from "@/components/glass";
import { ScreenHeader } from "@/components/screen-header";
import { ErrorState, Loading } from "@/components/states";
import { VillagePicker } from "@/components/village-picker";
import { useAsync } from "@/hooks/use-async";
import {
  ApiError,
  type Calcul,
  computeItineraire,
  type CritereVoyageur,
  fetchReseau,
  requestItineraire,
} from "@/lib/api";
import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

const MAX_VISITES = 8;
const km = (v: number) => `${v.toFixed(1).replace(".", ",")} km`;
const duree = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;

/**
 * « Créer mon itinéraire » (étape 4b) : départ, arrivée et villages à visiter sur le réseau de
 * l'agence du voyageur, critère ; le meilleur itinéraire s'affiche sur la carte, puis le
 * voyageur l'envoie à l'agence (titre et message).
 */
export default function NouvelItineraireScreen() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { theme } = useTheme();
  const { data, error, reload } = useAsync(() => fetchReseau(), "reseau");
  const [depart, setDepart] = useState<string | null>(null);
  const [arrivee, setArrivee] = useState<string | null>(null);
  const [visites, setVisites] = useState<string[]>([]);
  const [ordreLibre, setOrdreLibre] = useState(false);
  const [critere, setCritere] = useState<CritereVoyageur>("PLUS_COURT");
  const [calcul, setCalcul] = useState<Calcul | null>(null);
  const [titre, setTitre] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<"calcul" | "envoi" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const villages = data.etapes;
  const nom = (id: string | null) => villages.find((v) => v.id === id)?.nom ?? "";
  const choisis = [depart, arrivee, ...visites].filter((x): x is string => !!x);

  function reset() {
    setCalcul(null);
    setFormError(null);
  }

  async function calculer() {
    if (!depart || !arrivee) return setFormError("Choisissez le départ et l'arrivée.");
    setPending("calcul");
    setFormError(null);
    try {
      const res = await computeItineraire({
        etapeDepartId: depart,
        etapeArriveeId: arrivee,
        etapesImposees: visites,
        ordreLibre,
        critere,
      });
      setCalcul(res);
      setTitre(`${nom(depart)} – ${nom(arrivee)}`);
    } catch (e: unknown) {
      setFormError(e instanceof ApiError ? e.message : "Calcul impossible.");
    } finally {
      setPending(null);
    }
  }

  async function envoyer() {
    if (!calcul?.historiqueId) return;
    setPending("envoi");
    setFormError(null);
    try {
      const { id } = await requestItineraire({
        historiqueId: calcul.historiqueId,
        titre,
        message,
      });
      router.replace({ pathname: "/itineraires/[id]", params: { id } });
    } catch (e: unknown) {
      setFormError(e instanceof ApiError ? e.message : "Envoi impossible.");
    } finally {
      setPending(null);
    }
  }

  return (
    <View style={s.screen}>
      <ScreenHeader kicker="Voyages sur mesure" title="Créer mon itinéraire" />
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.card}>
          <VillagePicker
            label="Départ"
            villages={villages}
            value={depart}
            exclude={visites}
            onChange={(id) => {
              setDepart(id);
              reset();
            }}
          />
          <VillagePicker
            label="Arrivée"
            villages={villages}
            value={arrivee}
            exclude={visites}
            onChange={(id) => {
              setArrivee(id);
              reset();
            }}
          />
          <Text style={s.label}>Villages à visiter ({visites.length})</Text>
          {visites.map((id, i) => (
            <View key={id} style={s.visite}>
              <Text style={s.visiteText}>
                {i + 1}. {nom(id)}
              </Text>
              <Pressable
                onPress={() => {
                  setVisites((v) => v.filter((x) => x !== id));
                  reset();
                }}
                accessibilityRole="button"
                accessibilityLabel={`Retirer ${nom(id)}`}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={20} color={theme.textMuted} />
              </Pressable>
            </View>
          ))}
          {visites.length < MAX_VISITES ? (
            <VillagePicker
              label="Ajouter un village"
              villages={villages}
              value={null}
              exclude={choisis}
              placeholder="Ajouter un village à visiter"
              onChange={(id) => {
                setVisites((v) => [...v, id]);
                reset();
              }}
            />
          ) : null}
          {visites.length > 1 ? (
            <View style={s.switchRow}>
              <Text style={s.switchText}>Trouver le meilleur ordre de visite</Text>
              <Switch
                value={ordreLibre}
                onValueChange={(v) => {
                  setOrdreLibre(v);
                  reset();
                }}
                accessibilityLabel="Trouver le meilleur ordre de visite"
              />
            </View>
          ) : null}
          <Text style={s.label}>Je préfère l&apos;itinéraire…</Text>
          <Segmented<CritereVoyageur>
            options={[
              { key: "PLUS_COURT", label: "Le plus court" },
              { key: "PLUS_RAPIDE", label: "Le plus rapide" },
              { key: "PLUS_FACILE", label: "Le plus facile" },
            ]}
            value={critere}
            onChange={(c) => {
              setCritere(c);
              reset();
            }}
          />
          <FormError message={pending ? null : formError} />
          <Button
            label={pending === "calcul" ? "Calcul…" : "Calculer le meilleur itinéraire"}
            icon="navigate-outline"
            pending={pending === "calcul"}
            onPress={() => void calculer()}
          />
        </View>

        {calcul && !calcul.found ? (
          <View style={s.card}>
            <Text style={s.paragraph}>{calcul.message ?? "Aucun itinéraire trouvé."}</Text>
          </View>
        ) : null}

        {calcul?.found ? (
          <>
            <View style={s.map}>
              <CircuitMap
                steps={calcul.etapes.map((e, i) => ({
                  ordre: i + 1,
                  nom: e.nom,
                  latitude: e.latitude,
                  longitude: e.longitude,
                }))}
                trace={calcul.etapes.map((e) => [e.latitude, e.longitude] as const)}
                interactive={false}
                labels
              />
            </View>
            <View style={s.stats}>
              <Stat label="Distance" value={km(calcul.distanceKm)} />
              <Stat label="Marche" value={duree(calcul.dureeMinutes)} />
              <Stat
                label="Difficulté"
                value={`${calcul.difficulteMoyenne.toFixed(1).replace(".", ",")} / 5`}
              />
            </View>
            <View style={s.card}>
              <Text style={s.h2}>Envoyer à l&apos;agence</Text>
              <Field label="Titre" value={titre} onChangeText={setTitre} maxLength={150} />
              <Field
                label="Message (facultatif)"
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={1000}
                placeholder="Dates souhaitées, nombre de voyageurs, questions…"
                style={{ minHeight: 90, textAlignVertical: "top" }}
              />
              <FormError message={formError} />
              <Button
                label={pending === "envoi" ? "Envoi…" : "Envoyer à l'agence"}
                icon="send"
                pending={pending === "envoi"}
                onPress={() => void envoyer()}
              />
            </View>
          </>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const s = useStyles();
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 18, gap: 14 },
    card: { backgroundColor: t.surface, borderRadius: radius.md, padding: 16, gap: 12 },
    label: { fontFamily: fonts.textMedium, fontSize: 13, color: t.text, marginLeft: 4 },
    visite: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: t.accentSoft,
      borderRadius: radius.sm,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    visiteText: { fontFamily: fonts.textMedium, fontSize: 14, color: t.text },
    switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    switchText: { flex: 1, fontFamily: fonts.text, fontSize: 14, color: t.text },
    paragraph: { fontFamily: fonts.text, fontSize: 14, lineHeight: 21, color: t.textMuted },
    map: { height: 320, borderRadius: radius.md, overflow: "hidden" },
    stats: { flexDirection: "row", gap: 8 },
    stat: { flex: 1, backgroundColor: t.surface, borderRadius: radius.md, padding: 12, gap: 2 },
    statValue: { fontFamily: fonts.textSemiBold, fontSize: 15, color: t.text },
    statLabel: { fontFamily: fonts.text, fontSize: 11, color: t.textMuted },
    h2: { fontFamily: fonts.display, fontSize: 18, color: t.text },
  }),
);
