import type { Metadata } from "next";

import { AgencyDashboardView } from "@/components/dashboard/agency-dashboard-view";
import { GuideDashboardView } from "@/components/dashboard/guide-dashboard-view";
import { requireAgencyUser } from "@/lib/auth/session";
import { getAgencyDashboard } from "@/lib/dashboard/agency";
import { getGuideDashboard } from "@/lib/dashboard/guide";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Tableau de bord — Green Trek" };

/**
 * Accueil du back-office. Indicateurs calculés en direct sur la base, via le client confiné
 * à l'agence. Le guide a sa propre vue (ses départs uniquement, matrice §3).
 */
export default async function DashboardPage() {
  const { user, db } = await requireAgencyUser();
  const now = new Date();

  if (user.role === "GUIDE") {
    return <GuideDashboardView data={await getGuideDashboard(db, user.id, now)} />;
  }

  const data = await getAgencyDashboard(db, user.agenceId, now);
  return (
    <AgencyDashboardView
      data={data}
      now={now}
      showSubscription={can(user.role, "lire", "abonnement")}
    />
  );
}
