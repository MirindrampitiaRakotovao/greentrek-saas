import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AvisForm } from "@/components/avis-form";
import { Avatar } from "@/components/avatar";
import { CircuitMap } from "@/components/circuit-map";
import { FavoriteButton } from "@/components/favorite-button";
import { Button } from "@/components/form";
import { Glass, GlassIconButton, Segmented } from "@/components/glass";
import { Stars } from "@/components/stars";
import { Empty, ErrorState, Loading } from "@/components/states";
import { useAuth } from "@/context/auth";
import { useAsync } from "@/hooks/use-async";
import { type CircuitDetail, fetchCircuit, fetchMonAvis, imageUrl } from "@/lib/api";
import { confirmAction } from "@/lib/confirm";
import {
  DIFFICULTE_LABELS,
  formatDayRange,
  formatDuree,
  formatMoney,
  formatPlaces,
} from "@/lib/format";
import { makeStyles, useTheme } from "@/theme/theme";
import { colors, fonts, radius } from "@/theme/tokens";

const MAP_HEIGHT = 440;
type Onglet = "circuit" | "departs" | "avis";

/** Étapes regroupées par jour (« Jour 1 »…), comme sur le site. */
function parJour(etapes: CircuitDetail["etapes"]) {
  const groups: { jour: number | null; etapes: CircuitDetail["etapes"] }[] = [];
  for (const e of etapes) {
    const last = groups.at(-1);
    if (last && last.jour === e.jour) last.etapes.push(e);
    else groups.push({ jour: e.jour, etapes: [e] });
  }
  return groups;
}

/**
 * Fiche d'un circuit (refonte, d'après la maquette) : la carte de l'itinéraire en grand
 * (étapes et tracé A*), un repère en verre (durée, distance, difficulté), puis un panneau à
 * onglets « Circuit / Départs / Avis » et une barre de réservation en verre.
 * Un compte voyageur est propre à une agence : pour réserver chez une autre agence, il faut
 * se reconnecter avec un compte de celle-ci.
 */
export default function CircuitScreen() {
  const { agence, slug } = useLocalSearchParams<{ agence: string; slug: string }>();
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const [onglet, setOnglet] = useState<Onglet>("circuit");
  const [fullMap, setFullMap] = useState(false);
  const {
    data: c,
    error,
    reload,
  } = useAsync(() => fetchCircuit(agence, slug), `${agence}/${slug}`);

  const back = (
    <GlassIconButton
      icon="chevron-back"
      label="Retour"
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
    />
  );

  if (error || !c) {
    return (
      <View style={[s.screen, { paddingTop: insets.top + 8, paddingHorizontal: 18 }]}>
        {back}
        {error ? <ErrorState message={error} onRetry={reload} /> : <Loading />}
      </View>
    );
  }

  async function reserver(departId: string) {
    if (user && user.agenceSlug === c!.agence.slug) {
      return router.push({
        pathname: "/reserver/[depart]",
        params: { depart: departId, agence: c!.agence.slug, circuit: c!.slug },
      });
    }
    const ok = await confirmAction({
      title: "Changer de compte ?",
      message: `Ce circuit est proposé par ${c!.agence.nom}. Votre compte est chez ${user?.agenceNom} : reconnectez-vous avec un compte ${c!.agence.nom}.`,
      confirmLabel: "Changer de compte",
    });
    if (ok) await logout();
  }

  const uri = imageUrl(c.image);
  const distance =
    c.distanceKm !== null ? c.distanceKm.toFixed(1).replace(".", ",") : String(c.etapes.length);

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <View style={{ height: MAP_HEIGHT }}>
          {c.etapes.length > 0 ? (
            <CircuitMap
              steps={c.etapes}
              trace={c.trace}
              interactive={false}
              labels
              padBottom={70}
            />
          ) : uri ? (
            <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : null}
          <LinearGradient
            colors={[theme.dark ? "rgba(6,26,31,0.7)" : "rgba(242,245,245,0.75)", "transparent"]}
            locations={[0, 1]}
            style={[s.fadeTop, { height: insets.top + 80 }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["transparent", theme.bg]}
            style={s.fadeBottom}
            pointerEvents="none"
          />
          <View style={s.widgetWrap}>
            <Glass strong rounded={radius.pill}>
              <View style={s.widget}>
                <View style={s.side}>
                  <Text style={s.sideValue}>{formatDuree(c.dureeJours)}</Text>
                  <Text style={s.sideLabel}>Durée</Text>
                </View>
                <View style={s.ring}>
                  <Text style={s.ringValue}>{distance}</Text>
                  <Text style={s.ringLabel}>{c.distanceKm !== null ? "km" : "étapes"}</Text>
                </View>
                <View style={s.side}>
                  <Text style={s.sideValue}>{DIFFICULTE_LABELS[c.difficulte] ?? c.difficulte}</Text>
                  <Text style={s.sideLabel}>Difficulté</Text>
                </View>
              </View>
            </Glass>
          </View>
        </View>

        <View style={s.sheet}>
          <Text style={s.agence}>{c.agence.nom}</Text>
          <Text style={s.title} accessibilityRole="header">
            {c.titre}
          </Text>
          {c.note ? <Stars note={c.note} /> : null}
          <MaNote agence={c.agence.slug} slug={c.slug} onPublished={() => setOnglet("avis")} />
          <Text style={s.mapNote}>
            {c.trace
              ? "Itinéraire optimisé le long des sentiers du réseau de l’agence."
              : "Tracé indicatif en ligne droite entre les étapes."}
          </Text>

          <View style={{ marginTop: 14 }}>
            <Segmented<Onglet>
              options={[
                { key: "circuit", label: "Circuit" },
                { key: "departs", label: `Départs (${c.departs.length})` },
                { key: "avis", label: `Avis (${c.avis.length})` },
              ]}
              value={onglet}
              onChange={setOnglet}
            />
          </View>

          {onglet === "circuit" ? (
            <View style={s.tab}>
              {c.resume ? <Text style={s.lead}>{c.resume}</Text> : null}
              {uri ? (
                <View style={s.photo}>
                  <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" />
                  {c.credit ? (
                    <Glass rounded={radius.sm} style={s.creditWrap}>
                      <Text style={s.credit}>{c.credit}</Text>
                    </Glass>
                  ) : null}
                </View>
              ) : null}
              {c.description ? <Text style={s.paragraph}>{c.description}</Text> : null}

              <Text style={s.h2} accessibilityRole="header">
                Itinéraire
              </Text>
              <View style={s.card}>
                {parJour(c.etapes).map((g, i) => (
                  <View key={`${g.jour ?? "x"}-${i}`} style={{ gap: 10 }}>
                    {g.jour !== null ? <Text style={s.dayTitle}>Jour {g.jour}</Text> : null}
                    {g.etapes.map((e, j) => (
                      <View key={e.ordre} style={s.step}>
                        <View style={s.rail}>
                          <View style={s.stepDot}>
                            <Text style={s.stepNum}>{e.ordre}</Text>
                          </View>
                          {j < g.etapes.length - 1 ? <View style={s.railLine} /> : null}
                        </View>
                        <View style={{ flex: 1, paddingBottom: 6 }}>
                          <Text style={s.stepName}>{e.nom}</Text>
                          {e.description ? (
                            <Text style={s.stepText} numberOfLines={2}>
                              {e.description}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
              </View>

              {c.partenaires.length > 0 ? (
                <>
                  <Text style={s.h2} accessibilityRole="header">
                    Avec les partenaires locaux
                  </Text>
                  <View style={s.card}>
                    {c.partenaires.map((p, i) => (
                      <View
                        key={`${p.partenaire}-${p.prestation}`}
                        style={[s.partner, i > 0 && s.partnerSep]}
                      >
                        <Ionicons name="leaf-outline" size={16} color={theme.accent} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.stepName}>{p.prestation}</Text>
                          <Text style={s.stepText}>
                            {p.partenaire} ·{" "}
                            {p.inclusDansPrix ? "inclus dans le prix" : "en option"}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          ) : null}

          {onglet === "departs" ? (
            <View style={s.tab}>
              {c.departs.length === 0 ? (
                <Empty
                  icon="calendar-outline"
                  message="Aucun départ ouvert pour l’instant. Écrivez à l’agence pour un départ sur mesure."
                />
              ) : (
                c.departs.map((d) => (
                  <View key={d.id} style={s.depart}>
                    <View style={s.departIcon}>
                      <Ionicons name="calendar" size={18} color={theme.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.departDate}>{formatDayRange(d.dateDebut, d.dateFin)}</Text>
                      <Text style={s.departMeta}>
                        {formatPlaces(d.placesLibres)} · {formatMoney(d.prix, c.agence.devise)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => void reserver(d.id)}
                      style={({ pressed }) => [s.reserve, pressed && { opacity: 0.85 }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Réserver le départ du ${formatDayRange(d.dateDebut, d.dateFin)}`}
                    >
                      <Text style={s.reserveText}>Réserver</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          ) : null}

          {onglet === "avis" ? (
            <View style={s.tab}>
              {c.avis.length === 0 ? (
                <Empty icon="star-outline" message="Pas encore d’avis publié pour ce circuit." />
              ) : (
                c.avis.map((a, i) => (
                  <View key={i} style={s.card}>
                    <View style={s.reviewHead}>
                      <Avatar name={a.auteur} photo={a.photo} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.reviewAuthor}>{a.auteur}</Text>
                        <Stars note={{ moyenne: a.note, nombre: 1 }} />
                      </View>
                    </View>
                    {a.commentaire ? <Text style={s.paragraph}>« {a.commentaire} »</Text> : null}
                  </View>
                ))
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[s.topBar, { top: insets.top + 8 }]}>
        {back}
        <View style={s.topRight}>
          {c.etapes.length > 0 ? (
            <GlassIconButton
              icon="expand-outline"
              label="Agrandir la carte"
              onPress={() => setFullMap(true)}
            />
          ) : null}
          <FavoriteButton agence={c.agence.slug} circuit={c.slug} titre={c.titre} size={44} />
        </View>
      </View>

      <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Glass strong rounded={radius.pill}>
          <View style={s.bottomRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.from}>à partir de</Text>
              <Text style={s.price}>
                {formatMoney(c.prixMin, c.agence.devise)}
                <Text style={s.unit}> /pers.</Text>
              </Text>
            </View>
            <Button
              label="Voir les départs"
              onPress={() => setOnglet("departs")}
              style={{ minHeight: 48 }}
            />
          </View>
        </Glass>
      </View>

      <Modal visible={fullMap} animationType="slide" onRequestClose={() => setFullMap(false)}>
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
          <CircuitMap steps={c.etapes} trace={c.trace} interactive labels />
          <View style={[s.topBar, { top: insets.top + 8 }]}>
            <GlassIconButton
              icon="close"
              label="Fermer la carte"
              onPress={() => setFullMap(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    fadeTop: { position: "absolute", left: 0, right: 0, top: 0 },
    fadeBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: 90 },
    topBar: {
      position: "absolute",
      left: 16,
      right: 16,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    topRight: { flexDirection: "row", gap: 8 },
    widgetWrap: { position: "absolute", left: 24, right: 24, bottom: 4 },
    widget: { flexDirection: "row", alignItems: "center", padding: 6 },
    side: { flex: 1, alignItems: "center", gap: 1 },
    sideValue: { fontFamily: fonts.textSemiBold, fontSize: 15, color: t.text },
    sideLabel: { fontFamily: fonts.text, fontSize: 11, color: t.textMuted },
    ring: {
      width: 86,
      height: 86,
      borderRadius: 43,
      borderWidth: 2.5,
      borderColor: t.accent,
      backgroundColor: t.dark ? "rgba(6,26,31,0.6)" : colors.teal900,
      alignItems: "center",
      justifyContent: "center",
    },
    ringValue: { fontFamily: fonts.display, fontSize: 24, color: colors.white },
    ringLabel: { fontFamily: fonts.text, fontSize: 11, color: "rgba(255,255,255,0.85)" },
    sheet: { paddingHorizontal: 20, paddingTop: 14, gap: 4 },
    agence: { fontFamily: fonts.script, fontSize: 22, color: t.accent },
    title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, color: t.text },
    mapNote: { fontFamily: fonts.text, fontSize: 11, color: t.textMuted, marginTop: 4 },
    tab: { gap: 12, marginTop: 16 },
    lead: { fontFamily: fonts.textMedium, fontSize: 15, lineHeight: 22, color: t.text },
    paragraph: { fontFamily: fonts.text, fontSize: 14, lineHeight: 21, color: t.textMuted },
    photo: {
      height: 190,
      borderRadius: radius.md,
      overflow: "hidden",
      justifyContent: "flex-end",
      padding: 8,
    },
    creditWrap: { alignSelf: "flex-start" },
    credit: { fontFamily: fonts.text, fontSize: 10, color: t.text, padding: 6 },
    h2: { fontFamily: fonts.display, fontSize: 20, color: t.text, marginTop: 8 },
    card: { backgroundColor: t.surface, borderRadius: radius.md, padding: 16, gap: 8 },
    dayTitle: { fontFamily: fonts.script, fontSize: 22, color: t.accent },
    step: { flexDirection: "row", gap: 12 },
    rail: { alignItems: "center", width: 26 },
    railLine: { flex: 1, width: 2, backgroundColor: t.border, marginTop: 2 },
    stepDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: t.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    stepNum: { fontFamily: fonts.textSemiBold, fontSize: 11, color: t.onPrimary },
    stepName: { fontFamily: fonts.textSemiBold, fontSize: 14, color: t.text },
    stepText: { fontFamily: fonts.text, fontSize: 12, lineHeight: 17, color: t.textMuted },
    partner: { flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 4 },
    partnerSep: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border,
      paddingTop: 10,
    },
    depart: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: t.surface,
      borderRadius: radius.md,
      padding: 12,
    },
    departIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: t.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    departDate: { fontFamily: fonts.textSemiBold, fontSize: 15, color: t.text },
    departMeta: { fontFamily: fonts.text, fontSize: 12, color: t.textMuted },
    reserve: {
      backgroundColor: t.primary,
      borderRadius: radius.pill,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    reserveText: { fontFamily: fonts.textSemiBold, fontSize: 14, color: t.onPrimary },
    reviewHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    reviewAuthor: { fontFamily: fonts.textMedium, fontSize: 12, color: t.accent },
    bottomBar: { position: "absolute", left: 14, right: 14, bottom: 0 },
    bottomRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 6, paddingLeft: 20 },
    from: { fontFamily: fonts.text, fontSize: 11, color: t.textMuted },
    price: { fontFamily: fonts.display, fontSize: 19, color: t.text },
    unit: { fontFamily: fonts.text, fontSize: 12, color: t.textMuted },
  }),
);

/**
 * « Votre note », sous le titre (étape 5b) : étoiles et commentaire pour un séjour terminé sur
 * ce circuit (RG 17 : un avis par séjour, publié après relecture de l'agence) ; sinon l'avis
 * déjà donné, ou rien pour qui n'a pas fait le circuit.
 */
function MaNote({
  agence,
  slug,
  onPublished,
}: {
  agence: string;
  slug: string;
  onPublished: () => void;
}) {
  const s = useStyles();
  const { user } = useAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const { data, reload } = useAsync(
    () => fetchMonAvis(agence, slug),
    `${user?.email}/${agence}/${slug}`,
  );
  if (!data || data.autreAgence) return null;
  if (data.reservationId && data.sejour) {
    return (
      <View style={[s.card, { marginTop: 14 }]}>
        <Text style={s.h2}>Votre note</Text>
        <Text style={s.stepText}>
          Votre séjour du {formatDayRange(data.sejour.dateDebut, data.sejour.dateFin)}
        </Text>
        <AvisForm
          reservationId={data.reservationId}
          onDone={(message) => {
            setNotice(message);
            reload();
            onPublished();
          }}
        />
      </View>
    );
  }
  if (data.dernierAvis) {
    return (
      <View style={[s.card, { marginTop: 14 }]}>
        <Text style={s.h2}>Votre note</Text>
        <Stars note={{ moyenne: data.dernierAvis.note, nombre: 1 }} />
        {data.dernierAvis.commentaire ? (
          <Text style={s.paragraph}>« {data.dernierAvis.commentaire} »</Text>
        ) : null}
        <Text style={s.stepText}>{notice ?? data.dernierAvis.statutLabel}</Text>
      </View>
    );
  }
  return (
    <Text style={[s.mapNote, { marginTop: 8 }]}>
      Vous pourrez noter ce circuit après votre séjour.
    </Text>
  );
}
