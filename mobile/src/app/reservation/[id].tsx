import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";

import { AvisForm } from "@/components/avis-form";
import { Button, FormError } from "@/components/form";
import { GlassIconButton } from "@/components/glass";
import { RequireAuth } from "@/components/require-auth";
import { ErrorState, Loading } from "@/components/states";
import { Stars } from "@/components/stars";
import { StatusPill } from "@/components/status-pill";
import { useAsync } from "@/hooks/use-async";
import { ApiError, cancelReservation, fetchReservation, imageUrl } from "@/lib/api";
import { apiBaseUrl } from "@/lib/config";
import { confirmAction } from "@/lib/confirm";
import { formatDayRange, formatMoney } from "@/lib/format";
import { makeStyles, useTheme } from "@/theme/theme";
import { colors, fonts, radius } from "@/theme/tokens";

/**
 * Fiche d'une réservation du voyageur : référence, statut, montants, voyageurs, paiements ;
 * payer le reste, annuler (RG 15 : avant le départ). `paye=1` : message de confirmation.
 */
export default function ReservationScreen() {
  return (
    <RequireAuth>
      <ReservationDetail />
    </RequireAuth>
  );
}

function ReservationDetail() {
  const styles = useStyles();
  const { theme } = useTheme();
  const { id, paye } = useLocalSearchParams<{ id: string; paye?: string }>();
  const insets = useSafeAreaInsets();
  const { data: r, error, reload } = useAsync(() => fetchReservation(id), id);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const back = (
    <View style={[styles.back, { top: insets.top + 8 }]}>
      <GlassIconButton
        icon="chevron-back"
        label="Retour"
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/reservations"))}
      />
    </View>
  );

  if (error)
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 60 }]}>
        {back}
        <ErrorState message={error} onRetry={reload} />
      </View>
    );
  if (!r)
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 60 }]}>
        {back}
        <Loading />
      </View>
    );

  async function cancel() {
    const ok = await confirmAction({
      title: "Annuler cette réservation ?",
      message: `La réservation ${r!.reference} sera annulée et les places libérées. Cette action est définitive.`,
      confirmLabel: "Annuler la réservation",
    });
    if (!ok) return;
    setActionError(null);
    setPending(true);
    try {
      const res = await cancelReservation(id);
      setNotice(res.message);
      reload();
    } catch (e: unknown) {
      setActionError(e instanceof ApiError ? e.message : "Annulation impossible.");
    } finally {
      setPending(false);
    }
  }

  const devise = r.agence.devise;
  const uri = imageUrl(r.circuit.image);
  const confirmee = paye === "1";

  return (
    <View style={styles.screen}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <View style={styles.hero}>
          {uri ? <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          <LinearGradient
            colors={["rgba(6,26,31,0.45)", "rgba(6,26,31,0.35)", theme.bg]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroBody}>
            <Text style={styles.reference}>{r.reference}</Text>
            <Text style={styles.title} accessibilityRole="header">
              {r.circuit.titre}
            </Text>
            <Text style={styles.heroMeta}>
              {r.agence.nom} · {formatDayRange(r.depart.dateDebut, r.depart.dateFin)}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {confirmee ? (
            <View style={styles.success} accessibilityRole="alert">
              <Ionicons name="checkmark-circle" size={24} color={theme.onPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.successTitle}>
                  {r.statut === "CONFIRMEE" ? "Réservation confirmée !" : "Paiement enregistré"}
                </Text>
                <Text style={styles.successText}>
                  {r.statut === "CONFIRMEE"
                    ? `Votre référence : ${r.reference}. Conservez-la pour tout échange avec ${r.agence.nom}.`
                    : "Il sera confirmé par l'agence à réception."}
                </Text>
              </View>
            </View>
          ) : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <View style={styles.card}>
            <View style={styles.between}>
              <Text style={styles.h2}>Montant</Text>
              <StatusPill statut={r.statut} label={r.statutLabel} />
            </View>
            <Text style={styles.amount}>{formatMoney(r.montantTotal, devise)}</Text>
            <Text style={styles.paragraph}>
              Payé : {formatMoney(r.paye, devise)} · reste : {formatMoney(r.reste, devise)}
            </Text>
            {r.peutPayer ? (
              <Button
                label={`Payer ${formatMoney(r.reste, devise)}`}
                onPress={() => router.push({ pathname: "/paiement/[id]", params: { id } })}
              />
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.h2}>Voyageurs ({r.nombrePersonnes})</Text>
            {r.participants.map((p, i) => (
              <Text key={i} style={styles.paragraph}>
                <Text style={styles.strong}>
                  {p.prenom} {p.nom}
                </Text>
                {p.age !== null ? ` · ${p.age} ans` : ""}
                {p.nationalite ? ` · ${p.nationalite}` : ""}
              </Text>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.h2}>Paiements</Text>
            {r.paiements.length === 0 ? (
              <Text style={styles.paragraph}>Aucun paiement pour l’instant.</Text>
            ) : (
              r.paiements.map((p) => (
                <View key={p.id} style={styles.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.strong}>{p.methodeLabel}</Text>
                    <Text style={styles.small}>{p.reference ?? "—"}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.strong}>{formatMoney(p.montant, devise)}</Text>
                    <Text style={styles.small}>{p.statutLabel}</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <Button
            label="Contacter l'agence"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/messages/nouveau",
                params: { reservation: r.id, reference: r.reference },
              })
            }
          />
          {r.facture ? (
            <Button
              label="Voir la facture"
              variant="secondary"
              onPress={() => void WebBrowser.openBrowserAsync(`${apiBaseUrl()}${r.facture}`)}
            />
          ) : null}

          {r.peutDonnerAvis ? (
            <View style={styles.card}>
              <Text style={styles.h2}>Votre avis sur ce séjour</Text>
              <AvisForm
                reservationId={r.id}
                onDone={(message) => {
                  setNotice(message);
                  reload();
                }}
              />
            </View>
          ) : r.avis ? (
            <View style={styles.card}>
              <View style={styles.between}>
                <Text style={styles.h2}>Votre avis</Text>
                <Text style={styles.small}>{r.avis.statutLabel}</Text>
              </View>
              <Stars note={{ moyenne: r.avis.note, nombre: 1 }} />
              {r.avis.commentaire ? (
                <Text style={styles.paragraph}>{r.avis.commentaire}</Text>
              ) : null}
            </View>
          ) : null}

          {r.remarques ? (
            <View style={styles.card}>
              <Text style={styles.h2}>Vos remarques</Text>
              <Text style={styles.paragraph}>{r.remarques}</Text>
            </View>
          ) : null}

          <FormError message={actionError} />
          {r.peutAnnuler ? (
            <View style={styles.card}>
              <Text style={styles.h2}>Annulation</Text>
              <Text style={styles.paragraph}>
                Possible jusqu’à la veille du départ. Les paiements déjà validés sont remboursés par
                l’agence.
              </Text>
              <Button
                label={pending ? "Annulation…" : "Annuler la réservation"}
                variant="danger"
                pending={pending}
                onPress={() => void cancel()}
              />
            </View>
          ) : null}
        </View>
      </KeyboardAwareScrollView>
      {back}
    </View>
  );
}

const useStyles = makeStyles((t) => {
  const card = {
    backgroundColor: t.surface,
    borderRadius: radius.md,
    padding: 16,
    gap: 8,
  } as const;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    back: { position: "absolute", left: 16 },
    hero: { height: 300, justifyContent: "flex-end", backgroundColor: colors.teal900 },
    heroBody: { padding: 20, gap: 4 },
    reference: {
      fontFamily: fonts.textMedium,
      fontSize: 13,
      letterSpacing: 1,
      color: colors.sand300,
    },
    title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: colors.white },
    heroMeta: { fontFamily: fonts.text, fontSize: 13, color: "rgba(255,255,255,0.9)" },
    content: { padding: 18, gap: 14 },
    success: {
      flexDirection: "row",
      gap: 12,
      backgroundColor: t.primary,
      borderRadius: radius.md,
      padding: 16,
    },
    successTitle: { fontFamily: fonts.textSemiBold, fontSize: 16, color: t.onPrimary },
    successText: {
      fontFamily: fonts.text,
      fontSize: 13,
      lineHeight: 19,
      color: t.onPrimary,
      opacity: 0.9,
    },
    notice: { fontFamily: fonts.textMedium, fontSize: 14, color: t.accent },
    card,
    between: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    h2: { fontFamily: fonts.display, fontSize: 18, color: t.text },
    amount: { fontFamily: fonts.display, fontSize: 28, color: t.text },
    paragraph: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: t.textMuted },
    strong: { fontFamily: fonts.textSemiBold, fontSize: 14, color: t.text },
    small: { fontFamily: fonts.text, fontSize: 12, color: t.textMuted },
  });
});
