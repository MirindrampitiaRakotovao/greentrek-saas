import { redirect } from "next/navigation";

import { getCurrentUser, homePathFor } from "@/lib/auth/session";

/** Aiguillage après connexion : chaque rôle est envoyé vers son propre espace. */
export default async function EspacePage() {
  const user = await getCurrentUser();
  redirect(user ? homePathFor(user) : "/connexion");
}
