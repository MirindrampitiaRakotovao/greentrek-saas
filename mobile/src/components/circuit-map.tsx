import { createElement } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { apiBaseUrl } from "@/lib/config";
import { buildMapHtml, type MapStep } from "@/lib/map-html";
import { useTheme } from "@/theme/theme";

/**
 * Carte d'un circuit (étapes et tracé), claire ou sombre selon le thème. Sur téléphone :
 * WebView ; l'adresse de base est celle du site, pour que les tuiles OpenStreetMap soient
 * demandées avec une page d'origine (règles d'usage d'OpenStreetMap). Dans l'aperçu web :
 * iframe. Internet est nécessaire (tuiles).
 */
export function CircuitMap({
  steps,
  trace,
  interactive = true,
  labels = false,
  padBottom = 0,
  style,
}: {
  steps: readonly MapStep[];
  trace: readonly (readonly [number, number])[] | null;
  interactive?: boolean;
  labels?: boolean;
  padBottom?: number;
  style?: object;
}) {
  const { theme } = useTheme();
  if (steps.length === 0) return null;
  const html = buildMapHtml({ steps, trace, interactive, labels, padBottom, dark: theme.dark });
  return (
    <View style={[styles.map, { backgroundColor: theme.bg }, style]}>
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
          style={{ flex: 1, backgroundColor: theme.bg }}
          scrollEnabled={false}
          nestedScrollEnabled
          setSupportMultipleWindows={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ map: { flex: 1, overflow: "hidden" } });
