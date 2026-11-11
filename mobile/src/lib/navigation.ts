import { type Href, router } from "expo-router";

/**
 * Après la connexion ou l'inscription : retour à l'écran d'origine (`retour`, chemin interne
 * à l'application), sinon fermeture de l'écran de connexion.
 */
export function afterAuth(retour?: string) {
  if (retour && retour.startsWith("/") && !retour.startsWith("//")) {
    router.replace(retour as Href);
  } else if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
}
