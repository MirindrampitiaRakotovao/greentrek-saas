import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { Link, router, useFocusEffect } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/form";
import { Empty, ErrorState, Loading } from "@/components/states";
import { StatusPill } from "@/components/status-pill";
import { useAuth } from "@/context/auth";
import { useAsync } from "@/hooks/use-async";
import { fetchReservations, imageUrl, type Reservation } from "@/lib/api";
import { formatDayRange, formatMoney } from "@/lib/format";
import { colors, fonts, radius } from "@/theme/tokens";

/** Onglet « Réservations » : les réservations du voyageur connecté (les siennes uniquement). */
export default function ReservationsScreen() {
  const { user } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.script}>Vos voyages</Text>
        <Text style={styles.title} accessibilityRole="header">
          Réservations
        </Text>
      </View>
      {user === null ? (
        <View style={styles.invite}>
          <Ionicons name="ticket-outline" size={40} color={colors.teal600} />
          <Text style={styles.inviteText}>
            Connectez-vous pour retrouver vos réservations, payer et suivre vos voyages.
          </Text>
          <Button
            label="Se connecter"
            onPress={() => router.push("/connexion")}
            style={{ alignSelf: "stretch" }}
          />
          <Button
            label="Créer un compte"
            variant="secondary"
            onPress={() => router.push("/inscription")}
            style={{ alignSelf: "stretch" }}
          />
        </View>
      ) : (
        <List bottom={tabBarHeight} accountKey={`${user.agenceSlug}/${user.email}`} />
      )}
    </SafeAreaView>
  );
}

function List({ bottom, accountKey }: { bottom: number; accountKey: string }) {
  const { data, error, loading, reload } = useAsync(() => fetchReservations(), accountKey);
  // Retour sur l'onglet (après une réservation ou un paiement) : liste à jour.
  useFocusEffect(useCallback(() => reload(), [reload]));

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <Loading label="Chargement de vos réservations…" />;
  return (
    <FlatList
      data={data.reservations}
      keyExtractor={(r) => r.id}
      renderItem={({ item }) => <ReservationCard r={item} />}
      contentContainerStyle={[styles.list, { paddingBottom: bottom + 24 }]}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      refreshing={loading}
      onRefresh={reload}
      ListEmptyComponent={
        <View style={{ gap: 12 }}>
          <Empty message="Vous n'avez pas encore de réservation." />
          <Button label="Découvrir les circuits" onPress={() => router.push("/explorer")} />
        </View>
      }
    />
  );
}

function ReservationCard({ r }: { r: Reservation }) {
  const uri = imageUrl(r.circuit.image);
  return (
    <Link href={{ pathname: "/reservation/[id]", params: { id: r.id } }} asChild>
      <Pressable style={styles.card} accessibilityRole="link">
        {uri ? (
          <Image source={uri} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, { backgroundColor: colors.teal100 }]} />
        )}
        <View style={{ flex: 1, gap: 3 }}>
          <View style={styles.between}>
            <Text style={styles.reference}>{r.reference}</Text>
            <StatusPill statut={r.statut} label={r.statutLabel} />
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {r.circuit.titre}
          </Text>
          <Text style={styles.meta}>
            {formatDayRange(r.depart.dateDebut, r.depart.dateFin)} · {r.nombrePersonnes} pers.
          </Text>
          <Text style={styles.price}>
            {formatMoney(r.montantTotal, r.agence.devise)}
            {r.peutPayer ? (
              <Text style={styles.toPay}> · reste {formatMoney(r.reste, r.agence.devise)}</Text>
            ) : null}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 6 },
  script: { fontFamily: fonts.script, fontSize: 22, color: colors.teal600 },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.teal900, marginTop: -4 },
  invite: { alignItems: "center", gap: 14, padding: 28 },
  inviteText: {
    fontFamily: fonts.text,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: "center",
  },
  list: { padding: 18, paddingTop: 8 },
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 10,
    backgroundColor: colors.white,
    borderRadius: radius.md,
  },
  thumb: { width: 84, height: 100, borderRadius: radius.sm + 2 },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6 },
  reference: { fontFamily: fonts.textMedium, fontSize: 11, color: colors.muted },
  cardTitle: { fontFamily: fonts.display, fontSize: 15, lineHeight: 18, color: colors.teal900 },
  meta: { fontFamily: fonts.text, fontSize: 12, color: colors.muted },
  price: { fontFamily: fonts.textSemiBold, fontSize: 14, color: colors.teal900 },
  toPay: { fontFamily: fonts.textMedium, fontSize: 12, color: colors.teal600 },
});
