import { createElement } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { apiBaseUrl } from "@/lib/config";
import { buildMapHtml, type MapStep } from "@/lib/map-html";
import { colors, fonts, radius } from "@/theme/tokens";

/**
 * Carte d'un circuit (étapes et tracé). Sur téléphone : WebView ; l'adresse de base est celle
 * du site, pour que les tuiles OpenStreetMap soient demandées avec une page d'origine (règles
 * d'usage d'OpenStreetMap). Dans l'aperçu web : iframe. Internet est nécessaire (tuiles).
 */
export function CircuitMap({
  steps,
  trace,
  height = 240,
  interactive = true,
}: {
  steps: readonly MapStep[];
  trace: readonly (readonly [number, number])[] | null;
  height?: number;
  interactive?: boolean;
}) {
  if (steps.length === 0) return null;
  const html = buildMapHtml({ steps, trace, interactive });
  return (
    <View style={styles.wrap}>
      <View style={[styles.map, { height }]}>
        {Platform.OS === "web" ? (
          createElement("iframe", {
            srcDoc: html,
            title: "Carte de l'itinéraire",
            style: { border: 0, width: "100%", height: "100%" },
          })
        ) : (
          <WebView
            originWhitelist={["*"]}
            source={{ html, baseUrl: apiBaseUrl() }}
            style={{ flex: 1, backgroundColor: colors.canvas }}
            scrollEnabled={false}
            nestedScrollEnabled
            setSupportMultipleWindows={false}
          />
        )}
      </View>
      <Text style={styles.note}>
        {trace
          ? "Tracé calculé (algorithme A*) à travers les sentiers du réseau de l’agence."
          : "Tracé indicatif en ligne droite entre les étapes."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  map: { borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.teal50 },
  note: { fontFamily: fonts.text, fontSize: 11, color: colors.muted },
});
