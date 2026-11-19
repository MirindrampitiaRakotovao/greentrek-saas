import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Field, FormError } from "@/components/form";
import { RequireAuth } from "@/components/require-auth";
import { ScreenHeader } from "@/components/screen-header";
import { ErrorState, Loading } from "@/components/states";
import { useAsync } from "@/hooks/use-async";
import { ApiError, createPublication, fetchSejoursPartageables } from "@/lib/api";
import { formatDayRange } from "@/lib/format";
import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

const PHOTOS_MAX = 4;

type Asset = { uri: string; mimeType?: string | null };

export default function NewPublicationScreen() {
  return (
    <RequireAuth>
      <NewPublication />
    </RequireAuth>
  );
}

/** Partager les photos d'un séjour terminé : séjour, 1 à 4 photos, légende facultative. */
function NewPublication() {
  const styles = useStyles();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, error: loadError, reload } = useAsync(() => fetchSejoursPartageables(), "sejours");
  const [choix, setChoix] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Asset[]>([]);
  const [legende, setLegende] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const reservationId = choix ?? data?.sejours[0]?.id ?? null;

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: 0.7,
  };

  function add(result: ImagePicker.ImagePickerResult) {
    if (result.canceled) return;
    const next = [...photos, ...result.assets.map((a) => ({ uri: a.uri, mimeType: a.mimeType }))];
    if (next.length > PHOTOS_MAX)
      setError(`${PHOTOS_MAX} photos au maximum : les premières sont gardées.`);
    setPhotos(next.slice(0, PHOTOS_MAX));
  }

  async function fromLibrary() {
    setError(null);
    if (Platform.OS !== "web") {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return setError("Autorisez l'accès aux photos dans les réglages.");
    }
    add(
      await ImagePicker.launchImageLibraryAsync({
        ...options,
        allowsMultipleSelection: true,
        selectionLimit: PHOTOS_MAX - photos.length,
      }),
    );
  }

  async function fromCamera() {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return setError("Autorisez l'appareil photo dans les réglages.");
    add(await ImagePicker.launchCameraAsync(options));
  }

  async function submit() {
    if (!reservationId) return;
    setPending(true);
    setError(null);
    try {
      const { id } = await createPublication({ reservationId, legende, photos });
      router.replace({ pathname: "/communaute/[id]", params: { id } });
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Publication impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader kicker="Communauté" title="Partager mes photos" />
      {loadError ? (
        <ErrorState message={loadError} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : data.sejours.length === 0 ? (
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.body}>
              Vous pourrez partager vos photos une fois votre premier séjour terminé.
            </Text>
          </View>
        </View>
      ) : (
        <KeyboardAwareScrollView
          bottomOffset={24}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.label}>Séjour</Text>
            {data.sejours.map((s) => {
              const selected = s.id === reservationId;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setChoix(s.id)}
                  style={[styles.option, selected && styles.optionOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Ionicons
                    name={selected ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={theme.accent}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>{s.circuit}</Text>
                    <Text style={styles.small}>{formatDayRange(s.dateDebut, s.dateFin)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>
              Photos ({photos.length}/{PHOTOS_MAX})
            </Text>
            <View style={styles.grid}>
              {photos.map((p, i) => (
                <View key={p.uri} style={styles.thumb}>
                  <Image
                    source={p.uri}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    accessibilityIgnoresInvertColors
                  />
                  <Pressable
                    onPress={() => setPhotos(photos.filter((_, j) => j !== i))}
                    style={styles.remove}
                    accessibilityRole="button"
                    accessibilityLabel={`Retirer la photo ${i + 1}`}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
            {photos.length < PHOTOS_MAX ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button label="Galerie" variant="secondary" onPress={() => void fromLibrary()} />
                </View>
                {Platform.OS !== "web" ? (
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Appareil photo"
                      variant="secondary"
                      onPress={() => void fromCamera()}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
            <Text style={styles.small}>
              La position GPS et les autres informations des photos sont retirées.
            </Text>
          </View>

          <View style={styles.card}>
            <Field
              label="Légende (facultative)"
              value={legende}
              onChangeText={setLegende}
              multiline
              maxLength={1000}
              placeholder="Un souvenir, un conseil pour les prochains voyageurs…"
              style={{ minHeight: 90, textAlignVertical: "top" }}
            />
            <Text style={styles.small}>
              Visible par les voyageurs de toutes les agences : votre prénom, votre initiale et
              votre photo de profil.
            </Text>
            <FormError message={error} />
            <Button
              label={pending ? "Publication…" : "Publier"}
              pending={pending}
              disabled={photos.length === 0}
              onPress={() => void submit()}
            />
          </View>
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 18, gap: 14 },
    card: { backgroundColor: t.surface, borderRadius: radius.md, padding: 16, gap: 12 },
    label: { fontFamily: fonts.textSemiBold, fontSize: 15, color: t.text },
    body: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: t.text },
    small: { fontFamily: fonts.text, fontSize: 12, color: t.textMuted },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: t.border,
      padding: 12,
    },
    optionOn: { borderColor: t.accent, backgroundColor: t.accentSoft },
    optionTitle: { fontFamily: fonts.textMedium, fontSize: 14, color: t.text },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    thumb: {
      width: 74,
      height: 74,
      borderRadius: radius.sm,
      overflow: "hidden",
      backgroundColor: t.surfaceAlt,
    },
    remove: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
    },
  }),
);
