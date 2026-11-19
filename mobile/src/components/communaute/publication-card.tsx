import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Avatar } from "@/components/avatar";
import {
  ApiError,
  deletePublication,
  imageUrl,
  type Publication,
  reportCommunityContent,
  setJaime,
} from "@/lib/api";
import { confirmAction } from "@/lib/confirm";
import { formatDateTime } from "@/lib/format";
import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

/**
 * Publication de la communauté : auteur, séjour, photos (défilement horizontal), légende,
 * « J'aime », commentaires ; « Supprimer » pour son auteur, « Signaler » pour les autres.
 */
export function PublicationCard({
  p,
  detail = false,
  onChanged,
  onMessage,
}: {
  p: Publication;
  /** Fiche : photos en entier (sans recadrage). */
  detail?: boolean;
  onChanged?: () => void;
  onMessage?: (text: string) => void;
}) {
  const s = useStyles();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const photoWidth = Math.min(width, 640) - 36 - 28;
  const [like, setLike] = useState({ jAime: p.jAime, jaimes: p.jaimes });
  const [index, setIndex] = useState(0);
  const open = () => router.push({ pathname: "/communaute/[id]", params: { id: p.id } });

  async function toggleLike() {
    const before = like;
    const next = { jAime: !like.jAime, jaimes: like.jaimes + (like.jAime ? -1 : 1) };
    setLike(next);
    try {
      setLike({ jAime: next.jAime, jaimes: (await setJaime(p.id, next.jAime)).jaimes });
    } catch (e: unknown) {
      setLike(before);
      onMessage?.(e instanceof ApiError ? e.message : "Action impossible.");
    }
  }

  async function remove() {
    const ok = await confirmAction({
      title: "Supprimer la publication ?",
      message: "Elle disparaîtra pour tout le monde.",
      confirmLabel: "Supprimer",
    });
    if (!ok) return;
    try {
      await deletePublication(p.id);
      if (detail) router.back();
      else onChanged?.();
    } catch (e: unknown) {
      onMessage?.(e instanceof ApiError ? e.message : "Suppression impossible.");
    }
  }

  async function report() {
    const ok = await confirmAction({
      title: "Signaler cette publication ?",
      message: "L'équipe de la plateforme l'examinera et pourra la masquer.",
      confirmLabel: "Signaler",
    });
    if (!ok) return;
    try {
      await reportCommunityContent("PUBLICATION", p.id);
      onMessage?.("Merci : l'équipe de la plateforme va examiner ce contenu.");
    } catch (e: unknown) {
      onMessage?.(e instanceof ApiError ? e.message : "Signalement impossible.");
    }
  }

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Avatar name={p.auteur.nom} photo={p.auteur.photo} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={s.author}>{p.auteur.nom}</Text>
          <Text style={s.meta} numberOfLines={2}>
            {p.circuit.titre} · avec {p.agence.nom} · {formatDateTime(p.at)}
          </Text>
        </View>
      </View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / photoWidth))
        }
        style={{ width: photoWidth, borderRadius: radius.md }}
      >
        {p.photos.map((src, i) => (
          <Pressable
            key={src}
            onPress={detail ? undefined : open}
            accessibilityRole={detail ? "image" : "link"}
            accessibilityLabel={`Photo ${i + 1} sur ${p.photos.length} du séjour ${p.circuit.titre}, par ${p.auteur.nom}`}
          >
            <Image
              source={imageUrl(src)}
              style={{
                width: photoWidth,
                height: detail ? photoWidth * 1.1 : photoWidth * 0.75,
                backgroundColor: theme.surfaceAlt,
              }}
              contentFit={detail ? "contain" : "cover"}
              accessibilityIgnoresInvertColors
            />
          </Pressable>
        ))}
      </ScrollView>
      {p.photos.length > 1 ? (
        <View
          style={s.dots}
          accessible
          accessibilityLabel={`Photo ${index + 1} sur ${p.photos.length}`}
        >
          {p.photos.map((src, i) => (
            <View key={src} style={[s.dot, i === index && s.dotOn]} />
          ))}
        </View>
      ) : null}
      {p.legende ? <Text style={s.legende}>{p.legende}</Text> : null}
      <View style={s.footer}>
        <Pressable
          onPress={() => void toggleLike()}
          style={s.action}
          accessibilityRole="button"
          accessibilityState={{ selected: like.jAime }}
          accessibilityLabel={`J'aime, ${like.jaimes}`}
        >
          <Ionicons
            name={like.jAime ? "heart" : "heart-outline"}
            size={22}
            color={like.jAime ? theme.danger : theme.text}
          />
          <Text style={s.actionText}>{like.jaimes}</Text>
        </Pressable>
        <Pressable
          onPress={detail ? undefined : open}
          style={s.action}
          accessibilityRole={detail ? "text" : "link"}
          accessibilityLabel={`${p.commentaires} commentaire${p.commentaires > 1 ? "s" : ""}`}
        >
          <Ionicons name="chatbubble-outline" size={20} color={theme.text} />
          <Text style={s.actionText}>{p.commentaires}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => void (p.deMoi ? remove() : report())}
          style={s.action}
          accessibilityRole="button"
          accessibilityLabel={p.deMoi ? "Supprimer la publication" : "Signaler la publication"}
        >
          <Ionicons
            name={p.deMoi ? "trash-outline" : "flag-outline"}
            size={18}
            color={theme.textMuted}
          />
          <Text style={s.small}>{p.deMoi ? "Supprimer" : "Signaler"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    card: { backgroundColor: t.surface, borderRadius: radius.lg, padding: 14, gap: 10 },
    header: { flexDirection: "row", alignItems: "center", gap: 10 },
    author: { fontFamily: fonts.textSemiBold, fontSize: 15, color: t.text },
    meta: { fontFamily: fonts.text, fontSize: 12, color: t.textMuted },
    dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.border },
    dotOn: { backgroundColor: t.accent },
    legende: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: t.text },
    footer: { flexDirection: "row", alignItems: "center", gap: 6 },
    action: { flexDirection: "row", alignItems: "center", gap: 5, padding: 6, minHeight: 40 },
    actionText: { fontFamily: fonts.textMedium, fontSize: 14, color: t.text },
    small: { fontFamily: fonts.text, fontSize: 12, color: t.textMuted },
  }),
);
