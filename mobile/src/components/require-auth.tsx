import { Redirect } from "expo-router";
import type { ReactNode } from "react";

import { useAuth } from "@/context/auth";

/**
 * Écran réservé au voyageur connecté. Depuis la refonte, toute l'application l'est (connexion
 * obligatoire après l'écran d'ouverture) : sans session, retour à la connexion.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Redirect href="/connexion" />;
  return children;
}
