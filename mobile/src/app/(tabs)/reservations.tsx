import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { Link, router, useFocusEffect } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/form";
import { Empty, ErrorState, Loading } from "@/components/states";
import { StatusPill } from "@/components/status-pill";
import { TabHeader } from "@/components/tab-header";
import { useAuth } from "@/context/auth";
import { useAsync } from "@/hooks/use-async";
import { fetchReservations, imageUrl, type Reservation } from "@/lib/api";
import { formatDayRange, formatMoney } from "@/lib/format";
import { makeStyles, useTheme } from "@/theme/theme";
import { fonts, radius } from "@/theme/tokens";

/** Onglet « Voyages » : les réservations du voyageur connecté (les siennes uniquement). */
export default function ReservationsScreen() {
  const { user } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const s = useStyles();
  const accountKey = `${user?.agenceSlug}/${user?.email}`;
  const { data, error, loading, reload } = useAsync(() => fetchReservations(), accountKey);
  // Retour sur l'onglet (après une réservation ou un paiement) : liste à jour.
  useFocusEffect(useCallback(() => reload(), [reload]));

  return (
    <View style={s.screen}>
      <TabHeader kicker="Vos réservations" title="Voyages" />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Loading label="Chargement de vos réservations…" />
      ) : (
        <FlatList
          data={data.reservations}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <ReservationCard r={item} />}
          contentContainerStyle={[s.list, { paddingBottom: tabBarHeight + 24 }]}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshing={loading}
          onRefresh={reload}
          ListEmptyComponent={
            <View style={{ gap: 12 }}>
              <Empty icon="ticket-outline" message="Vous n'avez pas encore de réservation." />
              <Button label="Découvrir les circuits" onPress={() => router.push("/explorer")} />
            </View>
          }
        />
      )}
    </View>
  );
}

function ReservationCard({ r }: { r: Reservation }) {
  const s = useStyles();
  const { theme } = useTheme();
  const uri = imageUrl(r.circuit.image);
  return (
    <Link href={{ pathname: "/reservation/[id]", params: { id: r.id } }} asChild>
      <Pressable
        style={({ pressed }) => [s.card, pressed && { opacity: 0.9 }]}
        accessibilityRole="link"
      >
        {uri ? (
          <Image source={uri} style={s.thumb} contentFit="cover" />
        ) : (
          <View style={[s.thumb, { backgroundColor: theme.surfaceAlt }]} />
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <View style={s.between}>
            <Text style={s.reference}>{r.reference}</Text>
            <StatusPill statut={r.statut} label={r.statutLabel} />
          </View>
          <Text style={s.cardTitle} numberOfLines={2}>
            {r.circuit.titre}
          </Text>
          <View style={s.meta}>
            <Ionicons name="calendar-outline" size={13} color={theme.accent} />
            <Text style={s.metaText}>
              {formatDayRange(r.depart.dateDebut, r.depart.dateFin)} · {r.nombrePersonnes} pers.
            </Text>
          </View>
          <Text style={s.price}>
            {formatMoney(r.montantTotal, r.agence.devise)}
            {r.peutPayer ? (
              <Text style={s.toPay}> · reste {formatMoney(r.reste, r.agence.devise)}</Text>
            ) : null}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    list: { padding: 18, paddingTop: 8 },
    card: {
      flexDirection: "row",
      gap: 14,
      padding: 10,
      backgroundColor: t.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
    },
    thumb: { width: 88, height: 108, borderRadius: radius.sm + 2 },
    between: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 6,
    },
    reference: { fontFamily: fonts.textMedium, fontSize: 11, color: t.textMuted },
    cardTitle: { fontFamily: fonts.display, fontSize: 15, lineHeight: 18, color: t.text },
    meta: { flexDirection: "row", alignItems: "center", gap: 5 },
    metaText: { fontFamily: fonts.text, fontSize: 12, color: t.textMuted },
    price: { fontFamily: fonts.textSemiBold, fontSize: 14, color: t.text },
    toPay: { fontFamily: fonts.textMedium, fontSize: 12, color: t.accent },
  }),
);
