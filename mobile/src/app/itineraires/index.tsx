import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/form";
import { GlassIconButton } from "@/components/glass";
import { ScreenHeader } from "@/components/screen-header";
import { Empty, ErrorState, Loading } from "@/components/states";
import { useAsync } from "@/hooks/use-async";
import { fetchItineraires, type Itineraire } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

const km = (v: number) => `${v.toFixed(1).replace(".", ",")} km`;
const duree = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;

/** « Mes itinéraires » : itinéraires sur mesure proposés par l'agence ou demandés. */
export default function ItinerairesScreen() {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { data, error, loading, reload } = useAsync(() => fetchItineraires(), "itineraires");
  useFocusEffect(useCallback(() => reload(), [reload]));

  return (
    <View style={s.screen}>
      <ScreenHeader
        kicker="Voyages sur mesure"
        title="Mes itinéraires"
        right={
          <GlassIconButton
            icon="add"
            label="Créer mon itinéraire"
            onPress={() => router.push("/itineraires/nouveau")}
          />
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <FlatList
          data={data.itineraires}
          keyExtractor={(it) => it.id}
          renderItem={({ item }) => <Row it={item} />}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 24 }]}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshing={loading}
          onRefresh={reload}
          ListEmptyComponent={
            <View style={{ gap: 12 }}>
              <Empty
                icon="map-outline"
                message="Aucun itinéraire pour l'instant. Composez le vôtre, ou votre agence vous en proposera un sur mesure."
              />
              <Button
                label="Créer mon itinéraire"
                icon="add"
                onPress={() => router.push("/itineraires/nouveau")}
              />
            </View>
          }
        />
      )}
    </View>
  );
}

function Row({ it }: { it: Itineraire }) {
  const s = useStyles();
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/itineraires/[id]", params: { id: it.id } })}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.9 }]}
      accessibilityRole="link"
    >
      <View style={s.icon}>
        <Ionicons name="map" size={20} color={theme.accent} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={s.between}>
          <Text style={s.title} numberOfLines={2}>
            {it.titre}
          </Text>
          <View style={[s.pill, it.statut === "EN_ATTENTE" && s.pillWait]}>
            <Text style={s.pillText}>{it.statutLabel}</Text>
          </View>
        </View>
        <Text style={s.meta} numberOfLines={1}>
          {it.depart} → {it.arrivee}
        </Text>
        <Text style={s.meta}>
          {km(it.distanceKm)} · {duree(it.dureeMinutes)} · {it.critere}
        </Text>
        <Text style={s.small}>
          {it.origine === "AGENCE" ? "Proposé par votre agence" : "Votre demande"} ·{" "}
          {formatDateTime(it.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    list: { padding: 18, paddingTop: 8 },
    card: {
      flexDirection: "row",
      gap: 12,
      backgroundColor: t.surface,
      borderRadius: radius.md,
      padding: 14,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: t.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    between: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    title: { flex: 1, fontFamily: fonts.display, fontSize: 16, color: t.text },
    meta: { fontFamily: fonts.text, fontSize: 13, color: t.textMuted },
    small: { fontFamily: fonts.text, fontSize: 11, color: t.textMuted },
    pill: {
      alignSelf: "flex-start",
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 3,
      backgroundColor: t.accentSoft,
    },
    pillWait: { backgroundColor: t.dangerSoft },
    pillText: { fontFamily: fonts.textSemiBold, fontSize: 11, color: t.text },
  }),
);
