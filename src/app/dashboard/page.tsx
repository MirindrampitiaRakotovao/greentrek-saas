import type { Metadata } from "next";

import { PlaceholderSpace } from "@/components/layout/placeholder-space";
import { requireAgencyUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Tableau de bord — Green Trek" };

/** Back-office provisoire (E2) : le vrai tableau de bord arrive en E3 et E10. */
export default async function DashboardPage() {
  const { user, db } = await requireAgencyUser();
  // Lecture via le client confiné : il ne peut renvoyer que l'agence de l'utilisateur.
  const [agence, nbUtilisateurs] = await Promise.all([
    db.agence.findUniqueOrThrow({ where: { id: user.agenceId } }),
    db.utilisateur.count(),
  ]);

  return (
    <PlaceholderSpace title="Tableau de bord" user={user} agenceNom={agence.nom}>
      <p className="mt-6 text-gt-teal-900/80">
        {nbUtilisateurs} compte{nbUtilisateurs > 1 ? "s" : ""} dans votre agence.
      </p>
    </PlaceholderSpace>
  );
}
