import { Alert, Platform } from "react-native";

/**
 * Confirmation avant une action irréversible (annuler une réservation). Boîte native sur
 * téléphone ; dans l'aperçu web, `Alert` de React Native ne s'affiche pas, d'où la boîte du
 * navigateur.
 */
export function confirmAction(input: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
}): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(globalThis.confirm?.(`${input.title}\n\n${input.message}`) ?? false);
  }
  return new Promise((resolve) =>
    Alert.alert(input.title, input.message, [
      { text: input.cancelLabel ?? "Retour", style: "cancel", onPress: () => resolve(false) },
      { text: input.confirmLabel, style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}
