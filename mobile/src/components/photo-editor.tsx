import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/context/auth";
import { ApiError, removePhoto, uploadPhoto } from "@/lib/api";
import { makeStyles } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

import { Avatar } from "./avatar";
import { Button, FormError } from "./form";

/**
 * Photo de profil : choisir dans la galerie ou prendre une photo (recadrage carré), puis
 * envoi. Le serveur réduit l'image et retire ses informations cachées (position GPS…).
 */
export function PhotoEditor() {
  const s = useStyles();
  const { user, updateUser } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  async function send(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || !result.assets[0]) return;
    setPending(true);
    setError(null);
    try {
      await updateUser(await uploadPhoto(result.assets[0]));
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Envoi impossible.");
    } finally {
      setPending(false);
    }
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  };

  async function fromLibrary() {
    await send(await ImagePicker.launchImageLibraryAsync(options));
  }

  async function fromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return setError("Autorisez l'appareil photo dans les réglages.");
    await send(await ImagePicker.launchCameraAsync(options));
  }

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await updateUser(await removePhoto());
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Opération impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={s.card}>
      <View style={s.row}>
        <Avatar name={`${user.prenom} ${user.nom}`} photo={user.photoUrl} size={84} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.h2}>Photo de profil</Text>
          <Text style={s.small}>
            Visible par votre agence et les autres voyageurs. Position GPS et informations cachées
            retirées.
          </Text>
        </View>
      </View>
      <FormError message={error} />
      <Button
        label={pending ? "Envoi…" : "Choisir dans la galerie"}
        icon="images-outline"
        pending={pending}
        onPress={() => void fromLibrary()}
      />
      {Platform.OS !== "web" ? (
        <Button
          label="Prendre une photo"
          icon="camera-outline"
          variant="secondary"
          disabled={pending}
          onPress={() => void fromCamera()}
        />
      ) : null}
      {user.photoUrl ? (
        <Button
          label="Retirer la photo"
          variant="danger"
          disabled={pending}
          onPress={() => void remove()}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    card: { backgroundColor: t.surface, borderRadius: radius.md, padding: 16, gap: 12 },
    row: { flexDirection: "row", alignItems: "center", gap: 14 },
    h2: { fontFamily: fonts.display, fontSize: 18, color: t.text },
    small: { fontFamily: fonts.text, fontSize: 12, lineHeight: 17, color: t.textMuted },
  }),
);
