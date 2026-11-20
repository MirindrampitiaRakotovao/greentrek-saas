import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

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
import { colors, fonts, radius } from "@/theme/tokens";

const EXTRAIT = 160;

/**
 * Publication de la communauté : auteur, séjour, photos en mosaïque (une grande, jusqu'à
 * quatre petites, « +N »), légende avec « lire la suite », « J'aime », commentaires et menu
 * « … » (Supprimer pour l'auteur, Signaler pour les autres). Fiche : photos en entier.
 */
export function PublicationCard({
  p,
  detail = false,
  credits,
  onChanged,
  onMessage,
  onDestination,
}: {
  p: Publication;
  detail?: boolean;
  /** Crédits des photos (fiche). */
  credits?: (string | null)[];
  onChanged?: () => void;
  onMessage?: (text: string) => void;
  /** Filtrer le fil sur la destination de la publication. */
  onDestination?: (id: string) => void;
}) {
  const s = useStyles();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const inner = Math.min(width, 640) - 36 - 28;
  const [like, setLike] = useState({ jAime: p.jAime, jaimes: p.jaimes });
  const [menu, setMenu] = useState(false);
  const [ouvert, setOuvert] = useState(detail);
  const open = () => router.push({ pathname: "/communaute/[id]", params: { id: p.id } });
  const longue = (p.legende?.length ?? 0) > EXTRAIT;

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

  async function act() {
    setMenu(false);
    const ok = await confirmAction(
      p.deMoi
        ? {
            title: "Supprimer la publication ?",
            message: "Elle disparaîtra pour tout le monde.",
            confirmLabel: "Supprimer",
          }
        : {
            title: "Signaler cette publication ?",
            message: "L'équipe de la plateforme l'examinera et pourra la masquer.",
            confirmLabel: "Signaler",
          },
    );
    if (!ok) return;
    try {
      if (p.deMoi) {
        await deletePublication(p.id);
        if (detail) router.back();
        else onChanged?.();
      } else {
        await reportCommunityContent("PUBLICATION", p.id);
        onMessage?.("Merci : l'équipe de la plateforme va examiner ce contenu.");
      }
    } catch (e: unknown) {
      onMessage?.(e instanceof ApiError ? e.message : "Action impossible.");
    }
  }

  const label = (i: number) =>
    `Photo ${i + 1} sur ${p.photos.length} du séjour ${p.circuit.titre}, par ${p.auteur.nom}`;

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Avatar name={p.auteur.nom} photo={p.auteur.photo} size={42} />
        <View style={{ flex: 1 }}>
          <Text style={s.author}>{p.auteur.nom}</Text>
          <Text style={s.meta} numberOfLines={2}>
            {p.circuit.titre} · avec {p.agence.nom}
          </Text>
          <Text style={s.date}>{formatDateTime(p.at)}</Text>
        </View>
        <Pressable
          onPress={() => setMenu(!menu)}
          hitSlop={8}
          style={s.more}
          accessibilityRole="button"
          accessibilityLabel="Actions sur la publication"
          accessibilityState={{ expanded: menu }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.textMuted} />
        </Pressable>
        {menu ? (
          <View style={s.menu}>
            <Pressable onPress={() => void act()} style={s.menuItem} accessibilityRole="menuitem">
              <Ionicons
                name={p.deMoi ? "trash-outline" : "flag-outline"}
                size={16}
                color={p.deMoi ? theme.danger : theme.text}
              />
              <Text style={[s.menuText, p.deMoi && { color: theme.danger }]}>
                {p.deMoi ? "Supprimer" : "Signaler"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {detail ? (
        <View style={{ gap: 12 }}>
          {p.photos.map((src, i) => (
            <View key={src} style={{ gap: 4 }}>
              <Image
                source={imageUrl(src)}
                style={{
                  width: inner,
                  height: inner * 0.8,
                  backgroundColor: theme.surfaceAlt,
                  borderRadius: radius.sm,
                }}
                contentFit="contain"
                accessibilityLabel={label(i)}
                accessibilityIgnoresInvertColors
              />
              {credits?.[i] ? <Text style={s.credit}>Photo : {credits[i]}</Text> : null}
            </View>
          ))}
        </View>
      ) : (
        <Pressable
          onPress={open}
          accessibilityRole="link"
          accessibilityLabel={`Voir la publication de ${p.auteur.nom}`}
        >
          <Mosaic photos={p.photos} width={inner} label={label} />
        </Pressable>
      )}

      {p.legende ? (
        <Text style={s.legende}>
          {longue && !ouvert ? `${p.legende.slice(0, EXTRAIT).trimEnd()}… ` : p.legende}
          {longue && !ouvert ? (
            <Text style={s.more2} onPress={() => setOuvert(true)} accessibilityRole="button">
              lire la suite
            </Text>
          ) : null}
        </Text>
      ) : null}

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
        {onDestination ? (
          <Pressable
            onPress={() => onDestination(p.circuit.id)}
            style={s.chip}
            accessibilityRole="button"
            accessibilityLabel={`Voir les publications de ${p.circuit.titre}`}
          >
            <Ionicons name="location-outline" size={13} color={theme.accent} />
            <Text style={s.chipText} numberOfLines={1}>
              {p.circuit.titre}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Mosaïque : une grande photo à gauche, jusqu'à quatre petites à droite, « +N » sur la dernière. */
function Mosaic({
  photos,
  width,
  label,
}: {
  photos: string[];
  width: number;
  label: (i: number) => string;
}) {
  const s = useStyles();
  const { theme } = useTheme();
  const gap = 4;
  const height = width * 0.66;
  const img = (src: string, i: number, w: number, h: number) => (
    <Image
      key={src}
      source={imageUrl(src)}
      style={{ width: w, height: h, backgroundColor: theme.surfaceAlt }}
      contentFit="cover"
      accessibilityLabel={label(i)}
      accessibilityIgnoresInvertColors
    />
  );
  if (photos.length === 1) {
    return <View style={s.mosaic}>{img(photos[0]!, 0, width, height)}</View>;
  }
  const shown = photos.slice(0, 5);
  const small = shown.slice(1);
  const reste = photos.length - shown.length;
  const half = (width - gap) / 2;
  const cols = small.length >= 3 ? 2 : 1;
  const rows = Math.ceil(small.length / cols);
  const cellW = cols === 2 ? (half - gap) / 2 : half;
  const cellH = (height - gap * (rows - 1)) / rows;
  return (
    <View style={[s.mosaic, { flexDirection: "row", gap }]}>
      {img(shown[0]!, 0, half, height)}
      <View style={{ width: half, flexDirection: "row", flexWrap: "wrap", gap }}>
        {small.map((src, k) => {
          // Trois petites : la dernière prend toute la largeur.
          const w = small.length === 3 && k === 2 ? half : cellW;
          return (
            <View key={src}>
              {img(src, k + 1, w, cellH)}
              {reste > 0 && k === small.length - 1 ? (
                <View style={s.plus} accessible accessibilityLabel={`${reste} autres photos`}>
                  <Text style={s.plusText}>+{reste}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    card: { backgroundColor: t.surface, borderRadius: radius.lg, padding: 14, gap: 10 },
    header: { flexDirection: "row", alignItems: "flex-start", gap: 10, zIndex: 2 },
    author: { fontFamily: fonts.textSemiBold, fontSize: 15, color: t.text },
    meta: { fontFamily: fonts.text, fontSize: 12, color: t.accent },
    date: { fontFamily: fonts.text, fontSize: 11, color: t.textMuted },
    more: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
    },
    menu: {
      position: "absolute",
      right: 0,
      top: 38,
      backgroundColor: t.surface,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: t.border,
      padding: 4,
      minWidth: 150,
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 6,
    },
    menuItem: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10 },
    menuText: { fontFamily: fonts.textMedium, fontSize: 14, color: t.text },
    mosaic: { borderRadius: radius.md, overflow: "hidden" },
    plus: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: "rgba(15,65,77,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    plusText: { fontFamily: fonts.display, fontSize: 22, color: colors.white },
    credit: { fontFamily: fonts.text, fontSize: 11, color: t.textMuted, textAlign: "center" },
    legende: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: t.text },
    more2: { fontFamily: fonts.textSemiBold, color: t.accent },
    footer: { flexDirection: "row", alignItems: "center", gap: 6 },
    action: { flexDirection: "row", alignItems: "center", gap: 5, padding: 6, minHeight: 40 },
    actionText: { fontFamily: fonts.textMedium, fontSize: 14, color: t.text },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      maxWidth: "45%",
      backgroundColor: t.accentSoft,
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    chipText: { fontFamily: fonts.textMedium, fontSize: 12, color: t.accent },
  }),
);
